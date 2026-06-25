import type { NextApiRequest, NextApiResponse } from 'next'

type ExplainCall = {
  index: number
  target: string
  nativeValue: string
  signature: string
  functionName: string | null
  params: Array<{
    name: string
    type: string
    value: string
    display?: string
    notes?: string
  }>
}

type ExplainRequestBody = {
  chainId?: number
  operationId?: string | null
  fingerprint?: string
  calls?: ExplainCall[]
}

type ExplainResponseBody = {
  summary: string
  perCall?: string[]
  cacheHit?: boolean
  fingerprint?: string
  generatedAt?: string
}

const EXPLAIN_PROMPT_VERSION = 'v2'
const EXPLANATION_TTL_MS = 24 * 60 * 60 * 1000
const responseCache = new Map<
  string,
  { expiresAt: number; value: ExplainResponseBody }
>()
const inFlight = new Map<string, Promise<ExplainResponseBody>>()

function asString(x: unknown): string {
  return typeof x === 'string' ? x : JSON.stringify(x)
}

function extractOutputText(responseJson: any): string | null {
  if (typeof responseJson?.output_text === 'string') return responseJson.output_text

  const output = Array.isArray(responseJson?.output) ? responseJson.output : []
  const parts: string[] = []
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string') parts.push(part.text)
    }
  }
  const joined = parts.join('\n').trim()
  return joined ? joined : null
}

function hashDjb2(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function buildFingerprint(body: ExplainRequestBody, calls: ExplainCall[]): string {
  const normalizedCalls = calls.map((c) => ({
    index: c.index,
    target: c.target.toLowerCase(),
    nativeValue: c.nativeValue,
    signature: c.signature || 'unknown',
    functionName: c.functionName ?? 'unknown',
    params: c.params.map((p) => ({
      name: p.name,
      type: p.type,
      value: p.value,
      display: p.display ?? null,
    })),
  }))

  return `opx-${hashDjb2(
    JSON.stringify({
      chainId: body.chainId ?? null,
      operationId: body.operationId ?? null,
      promptVersion: EXPLAIN_PROMPT_VERSION,
      calls: normalizedCalls,
    })
  )}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ enabled: Boolean(process.env.OPENAI_API_KEY) })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not set' })
  }

  const body = (req.body ?? {}) as ExplainRequestBody
  const calls = Array.isArray(body.calls) ? body.calls : []

  // Basic size protection
  const rawSize = Buffer.byteLength(JSON.stringify(body), 'utf8')
  if (rawSize > 80_000) {
    return res.status(413).json({ error: 'Payload too large' })
  }

  if (calls.length === 0) {
    return res.status(400).json({ error: 'Missing calls' })
  }

  const fingerprint = body.fingerprint || buildFingerprint(body, calls)
  const now = Date.now()
  const cached = responseCache.get(fingerprint)
  if (cached && cached.expiresAt > now) {
    const cachedSummary = typeof cached.value.summary === 'string'
      ? cached.value.summary.trim()
      : ''
    // Never reuse corrupt/empty summaries from cache.
    if (!cachedSummary) {
      responseCache.delete(fingerprint)
    } else {
      return res.status(200).json({
        ...cached.value,
        summary: cachedSummary,
        cacheHit: true,
        fingerprint,
      })
    }
  }

  if (cached && cached.expiresAt <= now) {
    responseCache.delete(fingerprint)
  }

  // GPT‑5 via Responses API
  const model = process.env.OPENAI_MODEL || 'gpt-5-nano'

  const system = [
    'You explain blockchain timelock operations to non-technical users.',
    'Be concise, neutral, and avoid jargon.',
    'Focus on what will happen if executed, and what assets/permissions may be affected.',
    'If information is missing, say so.',
    'IMPORTANT: When a param has a display value, ALWAYS use display in your explanation.',
    'Treat param.value as the raw on-chain/base-unit value (may not be human-readable).',
    'Return JSON only.',
  ].join(' ')

  const input = {
    chainId: body.chainId ?? null,
    operationId: body.operationId ?? null,
    calls: calls.map((c) => ({
      index: c.index,
      target: c.target,
      nativeValue: c.nativeValue,
      signature: c.signature,
      functionName: c.functionName,
      params: c.params.map((p) => ({
        name: p.name,
        type: p.type,
        value: p.value,
        display: p.display,
        notes: p.notes,
      })),
    })),
    output_format: {
      summary:
        'string: 2-4 sentences plain English describing overall effect of the operation',
      perCall:
        'string[]: one short sentence per call, in order, describing what it does',
    },
  }

  try {
    const task = inFlight.get(fingerprint) ?? (async () => {
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 2000,
          reasoning: { effort: 'low' },
          input:
            system +
            '\n\nExplain this timelock operation. Return JSON only. Input:\n' +
            JSON.stringify(input),
        }),
      })

      const text = await upstream.text()
      if (!upstream.ok) {
        throw new Error(
          JSON.stringify({
            type: 'upstream',
            status: upstream.status,
            message: text.slice(0, 2000),
          })
        )
      }

      const data = JSON.parse(text) as any
      const content = extractOutputText(data)
      if (!content) {
        throw new Error(
          JSON.stringify({ type: 'invalid_output', message: 'OpenAI response missing output_text' })
        )
      }

      let parsed: any = null
      try {
        parsed = JSON.parse(content)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error(
          JSON.stringify({
            type: 'parse',
            message: 'Failed to parse model JSON',
            raw: content.slice(0, 4000),
          })
        )
      }

      const summary = asString(parsed.summary ?? '').trim()
      if (!summary) {
        throw new Error(
          JSON.stringify({
            type: 'invalid_output',
            message: 'OpenAI response returned empty summary',
          })
        )
      }

      const responseBody: ExplainResponseBody = {
        summary,
        perCall: Array.isArray(parsed.perCall)
          ? parsed.perCall.map((x: unknown) => asString(x))
          : undefined,
        cacheHit: false,
        fingerprint,
        generatedAt: new Date().toISOString(),
      }

      responseCache.set(fingerprint, {
        expiresAt: Date.now() + EXPLANATION_TTL_MS,
        value: responseBody,
      })

      return responseBody
    })()

    inFlight.set(fingerprint, task)
    const responseBody = await task
    return res.status(200).json(responseBody)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      const parsed = JSON.parse(message) as any
      if (parsed?.type === 'upstream') {
        return res.status(502).json({
          error: 'OpenAI request failed',
          status: parsed.status,
          message: parsed.message,
        })
      }
      if (parsed?.type === 'parse') {
        return res.status(502).json({
          error: parsed.message,
          raw: parsed.raw,
        })
      }
      if (parsed?.type === 'invalid_output') {
        return res.status(502).json({
          error: parsed.message,
          fingerprint,
        })
      }
    } catch {
      // Continue to generic error response
    }
    return res.status(500).json({ error: 'Unexpected error', message })
  } finally {
    inFlight.delete(fingerprint)
  }
}

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
    human?: string
  }>
}

type ExplainRequestBody = {
  chainId?: number
  operationId?: string
  calls?: ExplainCall[]
}

function asString(x: unknown): string {
  return typeof x === 'string' ? x : JSON.stringify(x)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
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

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const system = [
    'You explain blockchain timelock operations to non-technical users.',
    'Be concise, neutral, and avoid jargon.',
    'Focus on what will happen if executed, and what assets/permissions may be affected.',
    'If information is missing, say so.',
    'Return JSON only.',
  ].join(' ')

  const user = {
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
        human: p.human,
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
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 450,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              'Explain this timelock operation. Return JSON only. Input:\n' +
              JSON.stringify(user),
          },
        ],
      }),
    })

    const text = await upstream.text()
    if (!upstream.ok) {
      return res.status(502).json({
        error: 'OpenAI request failed',
        status: upstream.status,
        message: text.slice(0, 2000),
      })
    }

    const data = JSON.parse(text) as any
    const content = data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ error: 'OpenAI response missing content' })
    }

    // Try to parse the model's JSON response
    let parsed: any = null
    try {
      parsed = JSON.parse(content)
    } catch {
      // Some models wrap JSON in fences; attempt to extract first JSON object.
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({
        error: 'Failed to parse model JSON',
        raw: content.slice(0, 4000),
      })
    }

    return res.status(200).json({
      summary: asString(parsed.summary ?? ''),
      perCall: Array.isArray(parsed.perCall)
        ? parsed.perCall.map((x: unknown) => asString(x))
        : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: 'Unexpected error', message })
  }
}



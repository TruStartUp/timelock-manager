import type { NextApiRequest, NextApiResponse } from 'next'

type SafeNetwork = 'mainnet' | 'testnet'

const SAFE_GATEWAY_BASE: Record<SafeNetwork, string> = {
  mainnet: process.env.SAFE_ROOTSTOCK_MAINNET_GATEWAY_URL || 'https://gateway.safe.rootstock.io',
  testnet: process.env.SAFE_ROOTSTOCK_TESTNET_GATEWAY_URL || 'https://gateway.safe.rootstock.io',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const networkParam = req.query.network
  const pathParam = req.query.path

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (networkParam !== 'mainnet' && networkParam !== 'testnet') {
    return res.status(400).json({ error: 'Invalid network param' })
  }

  const pathParts = Array.isArray(pathParam)
    ? pathParam
    : typeof pathParam === 'string'
      ? [pathParam]
      : []

  const upstreamUrl = new URL(
    `${SAFE_GATEWAY_BASE[networkParam as SafeNetwork]}/${pathParts.join('/')}`
  )

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'network' || key === 'path') continue
    if (typeof value === 'string') {
      upstreamUrl.searchParams.set(key, value)
    } else if (Array.isArray(value)) {
      upstreamUrl.searchParams.delete(key)
      for (const item of value) upstreamUrl.searchParams.append(key, item)
    }
  }

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' },
    })

    const contentType =
      upstreamRes.headers.get('content-type') || 'application/json'
    const body = await upstreamRes.text()

    res.setHeader('Content-Type', contentType)
    return res.status(upstreamRes.status).send(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(502).json({ error: 'Upstream request failed', message })
  }
}

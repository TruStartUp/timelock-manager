import type { NextApiRequest, NextApiResponse } from 'next'

type BlockscoutNetwork = 'mainnet' | 'testnet'

const BLOCKSCOUT_V2_API_BASE: Record<BlockscoutNetwork, string> = {
  mainnet: 'https://rootstock.blockscout.com/api/v2',
  testnet: 'https://rootstock-testnet.blockscout.com/api/v2',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const networkParam = req.query.network
  const pathParam = req.query.path

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (typeof networkParam !== 'string') {
    return res.status(400).json({ error: 'Missing network param' })
  }

  if (networkParam !== 'mainnet' && networkParam !== 'testnet') {
    return res.status(400).json({ error: 'Invalid network param' })
  }

  const network = networkParam as BlockscoutNetwork
  const pathParts = Array.isArray(pathParam)
    ? pathParam
    : typeof pathParam === 'string'
      ? [pathParam]
      : []

  const upstreamBase = BLOCKSCOUT_V2_API_BASE[network]
  const upstreamUrl = new URL(`${upstreamBase}/${pathParts.join('/')}`)

  // Forward query params (excluding dynamic route params)
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'network' || key === 'path') continue
    if (typeof value === 'string') {
      upstreamUrl.searchParams.set(key, value)
    } else if (Array.isArray(value)) {
      upstreamUrl.searchParams.delete(key)
      for (const v of value) upstreamUrl.searchParams.append(key, v)
    }
  }

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })

    const contentType = upstreamRes.headers.get('content-type') || 'application/json'
    const body = await upstreamRes.text()

    res.setHeader('Content-Type', contentType)
    return res.status(upstreamRes.status).send(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(502).json({ error: 'Upstream request failed', message })
  }
}


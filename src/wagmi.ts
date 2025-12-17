import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { rootstock, rootstockTestnet } from 'wagmi/chains'
import { http } from 'viem'

type RpcOverride = {
  enabled: boolean
  rpcUrl: string
  rpcChainId: number | null
}

function getChains() {
  return [
    rootstock,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
      ? [rootstockTestnet]
      : []),
  ] as const
}

export function makeWagmiConfig(rpcOverride?: RpcOverride) {
  const chains = getChains()

  const transports =
    rpcOverride?.enabled && rpcOverride.rpcUrl && rpcOverride.rpcChainId
      ? {
          [rpcOverride.rpcChainId]: http(rpcOverride.rpcUrl),
        }
      : undefined

  const projectId =
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ||
    process.env.NEXT_PUBLIC_RAINBOWKIT_PROJECT_ID ||
    'YOUR_PROJECT_ID'

  return getDefaultConfig({
    appName: 'RainbowKit App',
    projectId,
    chains: [...chains],
    ssr: true,
    transports,
  })
}

// Default config (no overrides) to preserve existing import style.
export const config = makeWagmiConfig()

'use client'

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { makeWagmiConfig } from '../../wagmi'
import { useNetworkConfig } from '@/hooks/useNetworkConfig'

const client = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  // T102: Reload wagmi config when custom RPC settings change.
  const { config: networkConfig } = useNetworkConfig()
  const wagmiConfig = React.useMemo(() => {
    return makeWagmiConfig({
      enabled: networkConfig.enabled,
      rpcUrl: networkConfig.rpcUrl,
      rpcChainId: networkConfig.rpcChainId,
    })
  }, [
    networkConfig.enabled,
    networkConfig.rpcUrl,
    networkConfig.rpcChainId,
  ])

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>{mounted && children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

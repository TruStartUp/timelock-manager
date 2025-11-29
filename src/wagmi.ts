import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { rootstock, rootstockTestnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'RainbowKit App',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    rootstock,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
      ? [rootstockTestnet]
      : []),
  ],
  ssr: true,
})

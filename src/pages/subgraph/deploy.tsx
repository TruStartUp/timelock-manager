import React from 'react'
import { useRouter } from 'next/router'
import SubgraphDeployView from '@/components/subgraph/SubgraphDeployView'

const SubgraphDeployPage = () => {
  const router = useRouter()
  const { address, startBlock, network } = router.query

  const initialAddress = typeof address === 'string' ? address : undefined
  const initialStartBlock = typeof startBlock === 'string' || typeof startBlock === 'number' ? startBlock : undefined

  let initialNetwork: 'rsk_mainnet' | 'rsk_testnet' | undefined
  if (network === 'rsk_mainnet' || network === 'rsk_testnet') {
    initialNetwork = network
  }

  return (
    <SubgraphDeployView
      initialAddress={initialAddress}
      initialStartBlock={initialStartBlock}
      initialNetwork={initialNetwork}
    />
  )
}

export default SubgraphDeployPage


import { toFunctionSelector, type Hex } from 'viem'

export type DangerousCall = {
  functionName: 'upgradeTo' | 'upgradeToAndCall' | 'transferOwnership' | 'updateDelay'
  selector: Hex
}

const DANGEROUS_SIGNATURES: Array<{ sig: string; name: DangerousCall['functionName'] }> =
  [
    { sig: 'upgradeTo(address)', name: 'upgradeTo' },
    { sig: 'upgradeToAndCall(address,bytes)', name: 'upgradeToAndCall' },
    { sig: 'transferOwnership(address)', name: 'transferOwnership' },
    { sig: 'updateDelay(uint256)', name: 'updateDelay' },
  ]

const DANGEROUS_SELECTORS: Record<string, DangerousCall['functionName']> =
  Object.fromEntries(
    DANGEROUS_SIGNATURES.map(({ sig, name }) => [
      toFunctionSelector(sig),
      name,
    ])
  )

export function getDangerousCallFromCalldata(
  calldata: string | null | undefined
): DangerousCall | null {
  if (!calldata || typeof calldata !== 'string') return null
  if (!calldata.startsWith('0x') || calldata.length < 10) return null

  const selector = calldata.slice(0, 10) as Hex
  const fn = DANGEROUS_SELECTORS[selector]
  if (!fn) return null

  return { functionName: fn, selector }
}



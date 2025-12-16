import { describe, expect, it } from 'vitest'
import { toFunctionSelector } from 'viem'
import { getDangerousCallFromCalldata } from '@/lib/dangerous'

describe('getDangerousCallFromCalldata', () => {
  it('detects upgradeTo(address)', () => {
    const selector = toFunctionSelector('upgradeTo(address)')
    const calldata = `${selector}${'0'.repeat(64)}` // dummy 32-byte arg
    expect(getDangerousCallFromCalldata(calldata)?.functionName).toBe('upgradeTo')
  })

  it('detects transferOwnership(address)', () => {
    const selector = toFunctionSelector('transferOwnership(address)')
    const calldata = `${selector}${'0'.repeat(64)}`
    expect(getDangerousCallFromCalldata(calldata)?.functionName).toBe(
      'transferOwnership'
    )
  })

  it('returns null for unknown selector', () => {
    expect(getDangerousCallFromCalldata('0x12345678deadbeef')).toBeNull()
  })

  it('returns null for non-hex calldata', () => {
    expect(getDangerousCallFromCalldata('not-hex')).toBeNull()
  })
})



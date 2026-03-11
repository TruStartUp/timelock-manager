import { describe, expect, test } from 'vitest'
import { calculateSafeHashes } from '@/lib/safeHash'

describe('calculateSafeHashes', () => {
  test('computes hashes for a current Safe version', () => {
    const result = calculateSafeHashes({
      chainId: 30,
      version: '1.3.0',
      safeAddress: '0x1234567890abcdef1234567890abcdef12345678',
      to: '0x1111111111111111111111111111111111111111',
      value: '0',
      data: '0x',
      operation: '0',
      safeTxGas: '0',
      baseGas: '0',
      gasPrice: '0',
      gasToken: '0x0000000000000000000000000000000000000000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
      nonce: '7',
    })

    expect(result.domainHash).toBe(
      '0x7b8a4249c6a016438914eca4831b301aa1407f170eb100540193b2f1c9e9bd96'
    )
    expect(result.messageHash).toBe(
      '0x5c42f2af67b8cef1733d8a371903afaea7002eeed96a2f51ed5079329ab3046a'
    )
    expect(result.safeTxHash).toBe(
      '0x6514195dd66383784eb3ac657675e5e41a68607659eecec3e9dcfdd39587f474'
    )
  })

  test('computes hashes for a legacy Safe version', () => {
    const result = calculateSafeHashes({
      chainId: 30,
      version: '1.1.1',
      safeAddress: '0x1234567890abcdef1234567890abcdef12345678',
      to: '0x2222222222222222222222222222222222222222',
      value: '1000000000000000000',
      data: '0xa9059cbb0000000000000000000000003333333333333333333333333333333333333333000000000000000000000000000000000000000000000000000000000000002a',
      operation: '0',
      safeTxGas: '120000',
      baseGas: '21000',
      gasPrice: '0',
      gasToken: '0x0000000000000000000000000000000000000000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
      nonce: '42',
    })

    expect(result.domainHash).toBe(
      '0xbbe9e8c35143ef5e6a6eff1aa4248ef2a124610c081fe7eb55a27823bf59baaf'
    )
    expect(result.messageHash).toBe(
      '0x6dea1481b95707a776739d5c348cdaf4a85038db9bdb0022b81c191a787dadcd'
    )
    expect(result.safeTxHash).toBe(
      '0x5e118d0b1ff2558ce95316d0cf2b9dd43393446834863abbf1ad71b12fc68a13'
    )
  })
})

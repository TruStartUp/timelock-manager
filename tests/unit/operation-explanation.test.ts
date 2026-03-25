import { describe, expect, it } from 'vitest'
import {
  buildExplainOperationPayload,
  buildExplanationFingerprint,
} from '@/lib/operationExplanation'
import { ABISource, ABIConfidence } from '@/services/blockscout/abi'

describe('operation explanation helpers', () => {
  const baseOperation = {
    fullId:
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    details: {
      callsDetails: [
        {
          target: '0x1111111111111111111111111111111111111111',
          value: '0',
          rawValue: BigInt(0),
          data:
            '0xa9059cbb00000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000000064' as `0x${string}`,
          signature: 'transfer(address,uint256)',
        },
      ],
    },
  }

  it('builds stable fingerprints for equivalent payloads', () => {
    const payloadA = buildExplainOperationPayload(baseOperation, 30)!
    const payloadB = buildExplainOperationPayload(baseOperation, 30)!

    expect(buildExplanationFingerprint(payloadA)).toBe(
      buildExplanationFingerprint(payloadB)
    )
  })

  it('changes fingerprint when call content changes', () => {
    const payloadA = buildExplainOperationPayload(baseOperation, 30)!
    const payloadB = buildExplainOperationPayload(
      {
        ...baseOperation,
        details: {
          callsDetails: [
            {
              ...baseOperation.details.callsDetails[0],
              value: '1',
              rawValue: BigInt(1),
            },
          ],
        },
      },
      30
    )!

    expect(buildExplanationFingerprint(payloadA)).not.toBe(
      buildExplanationFingerprint(payloadB)
    )
  })

  it('includes human display value when provided in context', () => {
    const payload = buildExplainOperationPayload(baseOperation, 30, {
      decodedByIndex: {
        0: {
          decoded: {
            target: '0x1111111111111111111111111111111111111111',
            selector: '0xa9059cbb',
            functionName: 'transfer',
            signature: 'transfer(address,uint256)',
            params: [
              { name: 'to', type: 'address', value: '0x2222222222222222222222222222222222222222' },
              { name: 'amount', type: 'uint256', value: '1000000000000000000' },
            ],
            source: ABISource.BLOCKSCOUT,
            confidence: ABIConfidence.HIGH,
            warnings: [],
            children: [],
          },
        },
      },
      humanAmountByIndex: {
        0: {
          paramIndex: 1,
          formatted: '1 TOKEN',
          raw: '1000000000000000000',
          symbol: 'TOKEN',
          decimals: 18,
        },
      },
    })

    expect(payload?.calls[0].params[1].display).toBe('1 TOKEN')
  })
})

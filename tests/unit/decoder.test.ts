/**
 * Unit tests for recursive calldata decoding
 *
 * Focus: TimelockController execute/executeBatch inner payload decoding.
 *
 * Note: This test asserts against the production decoder utility in
 * src/lib/decoder.ts (introduced in T071/T072).
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { encodeFunctionData, type Abi, type Address } from 'viem'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'
import { decodeCalldata } from '@/lib/decoder'

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

function asAddress(v: string): Address {
  return v as Address
}

describe('Recursive calldata decoding (TimelockController execute/executeBatch)', () => {
  it('decodes execute() outer call and recursively decodes inner payload', async () => {
    const outerTimelock = asAddress('0x1000000000000000000000000000000000000001')
    const token = asAddress('0x2000000000000000000000000000000000000002')

    const tokenAbi: Abi = [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: 'ok', type: 'bool' }],
      },
    ]

    const recipient = asAddress('0x3000000000000000000000000000000000000003')
    const amount = BigInt(123)

    const innerPayload = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipient, amount],
    })

    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'execute',
      args: [token, BigInt(0), innerPayload, ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = await decodeCalldata({
      calldata: outerCalldata,
      target: outerTimelock,
      abiByAddress: {
        [outerTimelock.toLowerCase()]: TimelockControllerABI as Abi,
        [token.toLowerCase()]: tokenAbi,
      },
    })

    expect(decoded.functionName).toBe('execute')
    expect(decoded.children).toHaveLength(1)
    expect(decoded.children[0].target).toBe(token)
    expect(decoded.children[0].functionName).toBe('transfer')
    expect(decoded.children[0].params[0].value).toBe(recipient)
    expect(decoded.children[0].params[1].value).toBe(amount)
  })

  it('decodes executeBatch() outer call and recursively decodes each inner payload', async () => {
    const outerTimelock = asAddress('0x1000000000000000000000000000000000000001')
    const token = asAddress('0x2000000000000000000000000000000000000002')

    const tokenAbi: Abi = [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: 'ok', type: 'bool' }],
      },
    ]

    const recipientA = asAddress('0x3000000000000000000000000000000000000003')
    const recipientB = asAddress('0x4000000000000000000000000000000000000004')

    const payloadA = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipientA, BigInt(1)],
    })

    const payloadB = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipientB, BigInt(2)],
    })

    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'executeBatch',
      args: [[token, token], [BigInt(0), BigInt(0)], [payloadA, payloadB], ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = await decodeCalldata({
      calldata: outerCalldata,
      target: outerTimelock,
      abiByAddress: {
        [outerTimelock.toLowerCase()]: TimelockControllerABI as Abi,
        [token.toLowerCase()]: tokenAbi,
      },
    })

    expect(decoded.functionName).toBe('executeBatch')
    expect(decoded.children).toHaveLength(2)
    expect(decoded.children[0].functionName).toBe('transfer')
    expect(decoded.children[0].params[0].value).toBe(recipientA)
    expect(decoded.children[0].params[1].value).toBe(BigInt(1))
    expect(decoded.children[1].functionName).toBe('transfer')
    expect(decoded.children[1].params[0].value).toBe(recipientB)
    expect(decoded.children[1].params[1].value).toBe(BigInt(2))
  })

  it('recursively decodes nested timelock executeBatch within timelock execute', async () => {
    const outerTimelock = asAddress('0x1000000000000000000000000000000000000001')
    const innerTimelock = asAddress('0x5000000000000000000000000000000000000005')
    const token = asAddress('0x2000000000000000000000000000000000000002')

    const tokenAbi: Abi = [
      {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: 'ok', type: 'bool' }],
      },
    ]

    const recipient = asAddress('0x3000000000000000000000000000000000000003')

    // innermost: token.transfer(recipient, 42)
    const tokenPayload = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipient, BigInt(42)],
    })

    // inner timelock: executeBatch([token],[0],[tokenPayload],pred,salt)
    const innerTimelockPayload = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'executeBatch',
      args: [[token], [BigInt(0)], [tokenPayload], ZERO_BYTES32, ZERO_BYTES32],
    })

    // outer timelock: execute(innerTimelock,0,innerTimelockPayload,pred,salt)
    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'execute',
      args: [innerTimelock, BigInt(0), innerTimelockPayload, ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = await decodeCalldata({
      calldata: outerCalldata,
      target: outerTimelock,
      abiByAddress: {
        [outerTimelock.toLowerCase()]: TimelockControllerABI as Abi,
        [innerTimelock.toLowerCase()]: TimelockControllerABI as Abi,
        [token.toLowerCase()]: tokenAbi,
      },
      maxDepth: 5,
    })

    expect(decoded.functionName).toBe('execute')
    expect(decoded.children).toHaveLength(1)
    expect(decoded.children[0].target).toBe(innerTimelock)
    expect(decoded.children[0].functionName).toBe('executeBatch')
    expect(decoded.children[0].children).toHaveLength(1)
    expect(decoded.children[0].children[0].target).toBe(token)
    expect(decoded.children[0].children[0].functionName).toBe('transfer')
    expect(decoded.children[0].children[0].params[0].value).toBe(recipient)
    expect(decoded.children[0].children[0].params[1].value).toBe(BigInt(42))
  })
})



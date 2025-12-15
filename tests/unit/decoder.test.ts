/**
 * Unit tests for recursive calldata decoding
 *
 * Focus: TimelockController execute/executeBatch inner payload decoding.
 *
 * Note: This test expresses the expected recursive decoding behavior in a small
 * in-test helper. Upcoming tasks (T071/T072) will introduce a production
 * decoder utility in src/lib/decoder.ts that should satisfy these expectations.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  decodeFunctionData,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import TimelockControllerABI from '@/lib/abis/TimelockController.json'

type DecodedCall = {
  target: Address
  functionName: string
  args: readonly unknown[]
  children: DecodedCall[]
}

type AbiByAddress = Record<string, Abi>

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

function asAddress(v: string): Address {
  return v as Address
}

function addrKey(addr: Address): string {
  return addr.toLowerCase()
}

function isTimelockFunction(fn: string): fn is 'execute' | 'executeBatch' {
  return fn === 'execute' || fn === 'executeBatch'
}

function decodeCallRecursive(params: {
  target: Address
  calldata: Hex
  abiByAddress: AbiByAddress
  maxDepth?: number
}): DecodedCall {
  const { target, calldata, abiByAddress, maxDepth = 5 } = params

  const abi = abiByAddress[addrKey(target)]
  if (!abi) {
    return {
      target,
      functionName: 'unknown',
      args: [],
      children: [],
    }
  }

  const decoded = decodeFunctionData({ abi, data: calldata })
  const functionName = decoded.functionName as string
  const args = (decoded.args ?? []) as readonly unknown[]

  const node: DecodedCall = {
    target,
    functionName,
    args,
    children: [],
  }

  if (maxDepth <= 0 || !isTimelockFunction(functionName)) {
    return node
  }

  // TimelockController recursion:
  // - execute(target,value,payload,predecessor,salt)
  // - executeBatch(targets,values,payloads,predecessor,salt)
  if (functionName === 'execute') {
    const [innerTarget, _value, payload] = args as [
      Address,
      bigint,
      Hex,
      Hex,
      Hex,
    ]

    node.children = [
      decodeCallRecursive({
        target: innerTarget,
        calldata: payload,
        abiByAddress,
        maxDepth: maxDepth - 1,
      }),
    ]
  } else if (functionName === 'executeBatch') {
    const [targets, _values, payloads] = args as [
      Address[],
      bigint[],
      Hex[],
      Hex,
      Hex,
    ]

    node.children = targets.map((t, i) =>
      decodeCallRecursive({
        target: t,
        calldata: payloads[i],
        abiByAddress,
        maxDepth: maxDepth - 1,
      })
    )
  }

  return node
}

describe('Recursive calldata decoding (TimelockController execute/executeBatch)', () => {
  it('decodes execute() outer call and recursively decodes inner payload', () => {
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
    const amount = 123n

    const innerPayload = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipient, amount],
    })

    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'execute',
      args: [token, 0n, innerPayload, ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = decodeCallRecursive({
      target: outerTimelock,
      calldata: outerCalldata,
      abiByAddress: {
        [addrKey(outerTimelock)]: TimelockControllerABI as Abi,
        [addrKey(token)]: tokenAbi,
      },
    })

    expect(decoded.functionName).toBe('execute')
    expect(decoded.children).toHaveLength(1)
    expect(decoded.children[0].target).toBe(token)
    expect(decoded.children[0].functionName).toBe('transfer')
    expect(decoded.children[0].args[0]).toBe(recipient)
    expect(decoded.children[0].args[1]).toBe(amount)
  })

  it('decodes executeBatch() outer call and recursively decodes each inner payload', () => {
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
      args: [recipientA, 1n],
    })

    const payloadB = encodeFunctionData({
      abi: tokenAbi,
      functionName: 'transfer',
      args: [recipientB, 2n],
    })

    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'executeBatch',
      args: [[token, token], [0n, 0n], [payloadA, payloadB], ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = decodeCallRecursive({
      target: outerTimelock,
      calldata: outerCalldata,
      abiByAddress: {
        [addrKey(outerTimelock)]: TimelockControllerABI as Abi,
        [addrKey(token)]: tokenAbi,
      },
    })

    expect(decoded.functionName).toBe('executeBatch')
    expect(decoded.children).toHaveLength(2)
    expect(decoded.children[0].functionName).toBe('transfer')
    expect(decoded.children[0].args[0]).toBe(recipientA)
    expect(decoded.children[0].args[1]).toBe(1n)
    expect(decoded.children[1].functionName).toBe('transfer')
    expect(decoded.children[1].args[0]).toBe(recipientB)
    expect(decoded.children[1].args[1]).toBe(2n)
  })

  it('recursively decodes nested timelock executeBatch within timelock execute', () => {
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
      args: [recipient, 42n],
    })

    // inner timelock: executeBatch([token],[0],[tokenPayload],pred,salt)
    const innerTimelockPayload = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'executeBatch',
      args: [[token], [0n], [tokenPayload], ZERO_BYTES32, ZERO_BYTES32],
    })

    // outer timelock: execute(innerTimelock,0,innerTimelockPayload,pred,salt)
    const outerCalldata = encodeFunctionData({
      abi: TimelockControllerABI as Abi,
      functionName: 'execute',
      args: [innerTimelock, 0n, innerTimelockPayload, ZERO_BYTES32, ZERO_BYTES32],
    })

    const decoded = decodeCallRecursive({
      target: outerTimelock,
      calldata: outerCalldata,
      abiByAddress: {
        [addrKey(outerTimelock)]: TimelockControllerABI as Abi,
        [addrKey(innerTimelock)]: TimelockControllerABI as Abi,
        [addrKey(token)]: tokenAbi,
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
    expect(decoded.children[0].children[0].args[0]).toBe(recipient)
    expect(decoded.children[0].children[0].args[1]).toBe(42n)
  })
})



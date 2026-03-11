import type { Address, Hex } from 'viem'
import type { DecodedCall } from '@/lib/decoder'

export type SafeVerificationNetwork = 'mainnet' | 'testnet'

export interface SafeTransactionParams {
  safeAddress: Address
  chainId: number
  version: string
  to: Address
  value: string
  data: Hex
  operation: '0' | '1'
  safeTxGas: string
  baseGas: string
  gasPrice: string
  gasToken: Address
  refundReceiver: Address
  nonce: string
}

export interface SafeVerificationPayload {
  network: SafeVerificationNetwork
  expectedSafeTxHash?: Hex
  transaction: SafeTransactionParams
}

export interface SafeVerificationResult extends SafeVerificationPayload {
  computedSafeTxHash: Hex
  domainHash: Hex
  messageHash: Hex
  isMatch: boolean | null
  decodedCall?: DecodedCall
  decodeError?: string
}

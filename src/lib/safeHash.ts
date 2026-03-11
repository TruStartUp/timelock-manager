import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'

const DOMAIN_SEPARATOR_TYPEHASH =
  '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218'
const DOMAIN_SEPARATOR_TYPEHASH_OLD =
  '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749'
const SAFE_TX_TYPEHASH =
  '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8'
const SAFE_TX_TYPEHASH_OLD =
  '0x14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20'

type SafeHashInput = {
  chainId: number
  safeAddress: Address
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
  version: string
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map((part) => Number(part) || 0)
  const bParts = b.split('.').map((part) => Number(part) || 0)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

export function calculateSafeDomainHash(params: {
  version: string
  chainId: number
  safeAddress: Address
}): Hex {
  const { version, chainId, safeAddress } = params
  const cleanVersion = version.trim()

  const encoded =
    compareVersions(cleanVersion, '1.2.0') <= 0
      ? encodeAbiParameters(
          [
            { type: 'bytes32' },
            { type: 'address' },
          ],
          [DOMAIN_SEPARATOR_TYPEHASH_OLD, safeAddress]
        )
      : encodeAbiParameters(
          [
            { type: 'bytes32' },
            { type: 'uint256' },
            { type: 'address' },
          ],
          [DOMAIN_SEPARATOR_TYPEHASH, BigInt(chainId), safeAddress]
        )

  return keccak256(encoded)
}

export function calculateSafeHashes(input: SafeHashInput): {
  domainHash: Hex
  messageHash: Hex
  safeTxHash: Hex
  encodedMessage: Hex
} {
  const cleanVersion = input.version.trim()
  const domainHash = calculateSafeDomainHash({
    version: cleanVersion,
    chainId: input.chainId,
    safeAddress: input.safeAddress,
  })

  const safeTxTypeHash =
    compareVersions(cleanVersion, '1.0.0') < 0
      ? SAFE_TX_TYPEHASH_OLD
      : SAFE_TX_TYPEHASH

  const dataHash = keccak256(input.data)
  const encodedMessage = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'uint8' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
    ],
    [
      safeTxTypeHash,
      input.to,
      BigInt(input.value),
      dataHash,
      Number(input.operation),
      BigInt(input.safeTxGas),
      BigInt(input.baseGas),
      BigInt(input.gasPrice),
      input.gasToken,
      input.refundReceiver,
      BigInt(input.nonce),
    ]
  )

  const messageHash = keccak256(encodedMessage)
  const safeTxHash = keccak256(
    (`0x1901${domainHash.slice(2)}${messageHash.slice(2)}`) as Hex
  )

  return {
    domainHash,
    messageHash,
    safeTxHash,
    encodedMessage,
  }
}

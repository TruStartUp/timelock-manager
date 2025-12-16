import { BaseError, ContractFunctionRevertedError } from 'viem'

/**
 * Convert viem/wagmi errors into user-friendly messages.
 *
 * This is intentionally conservative: it avoids leaking huge nested error blobs,
 * but still tries to surface the revert reason / custom error name when present.
 */
export function formatTxError(error: unknown): string {
  if (!error) return 'Unknown error'

  // viem errors are typically BaseError with nested causes.
  const base = error as unknown
  if (base instanceof BaseError) {
    const revert = base.walk(
      (err) => err instanceof ContractFunctionRevertedError
    ) as ContractFunctionRevertedError | undefined

    if (revert instanceof ContractFunctionRevertedError) {
      const errorName = (revert.data as any)?.errorName as string | undefined
      const args = (revert.data as any)?.args as unknown[] | undefined

      // TimelockController-specific friendly messages (common cases)
      if (errorName === 'TimelockInsufficientDelay') {
        const [delayArg, minDelayArg] = (args ?? []) as [bigint?, bigint?]
        return `Delay is too small. Provided ${
          delayArg !== undefined ? delayArg.toString() : '—'
        }s, but the contract requires at least ${
          minDelayArg !== undefined ? minDelayArg.toString() : '—'
        }s.`
      }

      if (errorName === 'TimelockUnauthorizedCaller') {
        return 'Unauthorized caller. Your wallet likely lacks the required role on this TimelockController.'
      }

      if (errorName) return `Transaction reverted: ${errorName}`
    }

    return base.shortMessage || base.message
  }

  if (error instanceof Error) return error.message
  return String(error)
}



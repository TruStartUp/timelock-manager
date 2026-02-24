/**
 * Deploy Timelock verify API
 *
 * Runs Hardhat verify in the contracts/ folder to verify the deployed Timelock
 * on Rootstock Explorer and Blockscout. No Hardhat deps imported here.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { isAddress } from 'viem'

const CONTRACTS_DIR = 'contracts'

const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  30: 'rootstockMainnet',
  31: 'rootstockTestnet',
}

export type VerifyRequestBody = {
  address: string
  chainId: number
  minDelay: number | string
  proposers: string[]
  executors: string[]
  admin: string
}

function validateBody(body: unknown): { ok: true; data: VerifyRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  const addressRaw = b.address
  const address = typeof addressRaw === 'string' ? addressRaw.trim().toLowerCase() : ''
  if (!address.startsWith('0x')) {
    if (!isAddress(`0x${address}` as `0x${string}`)) return { ok: false, error: 'Invalid contract address' }
  } else if (!isAddress(address as `0x${string}`)) {
    return { ok: false, error: 'Invalid contract address' }
  }

  const chainId = typeof b.chainId === 'number' ? b.chainId : Number(b.chainId)
  if (chainId !== 30 && chainId !== 31) {
    return { ok: false, error: 'chainId must be 30 (mainnet) or 31 (testnet)' }
  }

  const minDelayRaw = b.minDelay
  const minDelay =
    typeof minDelayRaw === 'string' ? minDelayRaw : typeof minDelayRaw === 'number' ? String(minDelayRaw) : ''
  if (minDelay === '' || !/^\d+$/.test(String(minDelay))) {
    return { ok: false, error: 'minDelay must be a non-negative number' }
  }

  const proposers = b.proposers
  if (!Array.isArray(proposers) || proposers.length === 0) {
    return { ok: false, error: 'proposers must be a non-empty array of addresses' }
  }
  const proposersNorm = proposers.map((p) => {
    const t = String(p).trim().toLowerCase()
    return t.startsWith('0x') ? t : `0x${t}`
  })
  for (const p of proposersNorm) {
    if (!isAddress(p as `0x${string}`)) return { ok: false, error: 'Invalid address in proposers' }
  }

  const executors = b.executors
  if (!Array.isArray(executors) || executors.length === 0) {
    return { ok: false, error: 'executors must be a non-empty array of addresses' }
  }
  const executorsNorm = executors.map((e) => {
    const t = String(e).trim().toLowerCase()
    return t.startsWith('0x') ? t : `0x${t}`
  })
  for (const e of executorsNorm) {
    if (!isAddress(e as `0x${string}`)) return { ok: false, error: 'Invalid address in executors' }
  }

  const adminRaw = b.admin
  const adminStr =
    adminRaw == null || adminRaw === ''
      ? '0x0000000000000000000000000000000000000000'
      : String(adminRaw).trim().toLowerCase()
  const admin = adminStr.startsWith('0x') ? adminStr : `0x${adminStr}`
  if (!isAddress(admin as `0x${string}`)) {
    return { ok: false, error: 'admin must be a valid address or empty' }
  }

  const addr = address.startsWith('0x') ? address : `0x${address}`
  return {
    ok: true,
    data: {
      address: addr,
      chainId,
      minDelay: String(minDelay),
      proposers: proposersNorm,
      executors: executorsNorm,
      admin,
    },
  }
}

/**
 * Runs Hardhat verify with --constructor-args-path so array args (proposers, executors)
 * are encoded correctly. Hardhat 3 does not accept JSON strings on CLI for array params.
 */
function runVerify(
  contractsPath: string,
  network: string,
  address: string,
  constructorArgsPath: string
): Promise<{ success: boolean; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['hardhat', 'verify', '--network', network, '--constructor-args-path', constructorArgsPath, address],
      {
        cwd: contractsPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
      })
    })
    child.on('error', (err) => {
      resolve({
        success: false,
        stdout: '',
        stderr: err.message,
      })
    })
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const validated = validateBody(req.body)
  if (!validated.ok) {
    return res.status(400).json({ error: validated.error })
  }

  const { address, chainId, minDelay, proposers, executors, admin } = validated.data
  const network = CHAIN_ID_TO_NETWORK[chainId]
  if (!network) {
    return res.status(400).json({ error: 'Unsupported chainId' })
  }

  const cwd = process.cwd()
  const contractsPath = join(cwd, CONTRACTS_DIR)
  const argsFileName = `.verify-constructor-args-${Date.now()}.mjs`
  const argsFilePath = join(contractsPath, argsFileName)

  // Hardhat 3 requires array constructor args via a file; CLI JSON strings cause "expected array value"
  const constructorArgs = [
    Number(minDelay),
    proposers,
    executors,
    admin,
  ]
  const fileContent = `export default ${JSON.stringify(constructorArgs)};\n`

  try {
    writeFileSync(argsFilePath, fileContent, 'utf8')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to write constructor args file'
    return res.status(500).json({ error: message })
  }

  try {
    const { success, stderr, stdout } = await runVerify(contractsPath, network, address, argsFileName)

    if (success) {
      return res.status(200).json({ success: true, message: 'Contract verified successfully.' })
    }
    const message = stderr.trim() || stdout.trim() || 'Verification failed'
    return res.status(500).json({ error: message })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed'
    return res.status(500).json({ error: message })
  } finally {
    if (existsSync(argsFilePath)) {
      try {
        unlinkSync(argsFilePath)
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

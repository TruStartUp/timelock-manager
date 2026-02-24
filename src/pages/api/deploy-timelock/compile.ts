/**
 * Deploy Timelock compile API
 *
 * Returns deployment payload (bytecode + encoded constructor args) for TimelockController.
 * Compilation runs only in the contracts/ folder via child_process; no Hardhat or
 * OpenZeppelin deps are imported here, so the app bundle stays small.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { encodeDeployData } from 'viem'
import { isAddress } from 'viem'

const CONTRACTS_DIR = 'contracts'
const ARTIFACT_PATH = join(CONTRACTS_DIR, 'artifacts', 'contracts', 'Timelock.sol', 'Timelock.json')

/** In-memory cache: bytecode and abi after first compile so we don't re-run Hardhat on every request. */
let cachedArtifact: { bytecode: string; abi: unknown[] } | null = null

/** Reset cache (for tests). */
export function __resetCompileCacheForTests(): void {
  cachedArtifact = null
}

export type CompileRequestBody = {
  minDelay: bigint
  proposers: `0x${string}`[]
  executors: `0x${string}`[]
  admin: `0x${string}`
}

function validateBody(body: unknown): { ok: true; data: CompileRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  const minDelayRaw = b.minDelay
  const minDelay =
    typeof minDelayRaw === 'string'
      ? Number(minDelayRaw)
      : typeof minDelayRaw === 'number'
        ? minDelayRaw
        : NaN
  if (!Number.isFinite(minDelay) || minDelay < 0) {
    return { ok: false, error: 'minDelay must be a non-negative number' }
  }

  const proposers = b.proposers
  if (!Array.isArray(proposers) || proposers.length === 0) {
    return { ok: false, error: 'proposers must be a non-empty array of addresses' }
  }
  for (let i = 0; i < proposers.length; i++) {
    const a = String(proposers[i]).trim().toLowerCase()
    if (!a.startsWith('0x')) {
      if (!isAddress(`0x${a}` as `0x${string}`)) return { ok: false, error: `proposers[${i}] is not a valid address` }
    } else if (!isAddress(a as `0x${string}`)) {
      return { ok: false, error: `proposers[${i}] is not a valid address` }
    }
  }

  const executors = b.executors
  if (!Array.isArray(executors) || executors.length === 0) {
    return { ok: false, error: 'executors must be a non-empty array of addresses' }
  }
  for (let i = 0; i < executors.length; i++) {
    const a = String(executors[i]).trim().toLowerCase()
    const addr = a.startsWith('0x') ? a : `0x${a}`
    if (!isAddress(addr as `0x${string}`)) {
      return { ok: false, error: `executors[${i}] is not a valid address` }
    }
  }

  const adminRaw = b.admin
  const adminStr = adminRaw == null || adminRaw === '' ? '0x0000000000000000000000000000000000000000' : String(adminRaw).trim().toLowerCase()
  const admin = adminStr.startsWith('0x') ? adminStr : `0x${adminStr}`
  if (!isAddress(admin as `0x${string}`)) {
    return { ok: false, error: 'admin must be a valid address or empty' }
  }

  const norm = (s: string) => {
    const t = String(s).trim().toLowerCase()
    return (t.startsWith('0x') ? t : `0x${t}`) as `0x${string}`
  }
  return {
    ok: true,
    data: {
      minDelay: BigInt(minDelay),
      proposers: proposers.map(norm),
      executors: executors.map(norm),
      admin: admin as `0x${string}`,
    },
  }
}

async function getArtifact(cwd: string): Promise<{ bytecode: string; abi: unknown[] } | null> {
  if (cachedArtifact) return cachedArtifact

  const artifactFullPath = join(cwd, ARTIFACT_PATH)
  try {
    const raw = await readFile(artifactFullPath, 'utf-8')
    const artifact = JSON.parse(raw) as { bytecode?: string; abi?: unknown[] }
    if (artifact?.bytecode && Array.isArray(artifact?.abi)) {
      cachedArtifact = { bytecode: artifact.bytecode, abi: artifact.abi }
      return cachedArtifact
    }
  } catch {
    // artifact not found or invalid
  }

  return null
}

function runCompile(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'compile'], {
      cwd: join(cwd, CONTRACTS_DIR),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Compile failed (exit ${code}): ${stderr.slice(-500)}`))
    })
    child.on('error', reject)
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

  const { minDelay, proposers, executors, admin } = validated.data
  const cwd = process.cwd()

  let artifact = await getArtifact(cwd)
  if (!artifact) {
    try {
      await runCompile(cwd)
      artifact = await getArtifact(cwd)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compilation failed'
      return res.status(500).json({ error: `Failed to compile contract: ${message}` })
    }
  }

  if (!artifact) {
    return res.status(500).json({ error: 'Artifact not found after compile' })
  }

  try {
    const data = encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
      args: [minDelay, proposers, executors, admin],
    })
    return res.status(200).json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encode failed'
    return res.status(500).json({ error: `Failed to encode deploy data: ${message}` })
  }
}

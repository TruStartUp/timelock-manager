/**
 * POST /api/subgraph/prepare
 *
 * Prepares a subgraph package for a newly deployed timelock: copies the template,
 * writes config (address, startBlock), runs codegen + build, and returns a ZIP.
 * The user deploys locally with their key; deploy key never touches the server.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { isAddress } from 'viem'
import archiver from 'archiver'

const SUBGRAPH_TESTNET = 'rootstock-timelock-testnet'
const SUBGRAPH_MAINNET = 'rootstock-timelock-mainnet'
const GRAPH_NETWORK_TESTNET = 'rootstock-testnet'
const GRAPH_NETWORK_MAINNET = 'rootstock'

type Network = 'rsk_testnet' | 'rsk_mainnet'

const TEMPLATES: Record<Network, { dir: string; graphNetwork: string }> = {
  rsk_testnet: { dir: SUBGRAPH_TESTNET, graphNetwork: GRAPH_NETWORK_TESTNET },
  rsk_mainnet: { dir: SUBGRAPH_MAINNET, graphNetwork: GRAPH_NETWORK_MAINNET },
}

function validateBody(
  body: unknown
): { ok: true; data: { address: string; startBlock: number; network: Network } } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  const addressRaw = b.address
  const address = typeof addressRaw === 'string' ? addressRaw.trim().toLowerCase() : ''
  const addr = address.startsWith('0x') ? address : `0x${address}`
  if (!isAddress(addr as `0x${string}`)) {
    return { ok: false, error: 'Invalid contract address' }
  }

  const startBlockRaw = b.startBlock
  const startBlock =
    typeof startBlockRaw === 'number'
      ? startBlockRaw
      : typeof startBlockRaw === 'string'
        ? parseInt(startBlockRaw, 10)
        : NaN
  if (!Number.isInteger(startBlock) || startBlock < 1) {
    return { ok: false, error: 'startBlock must be a positive integer' }
  }

  const networkRaw = b.network
  if (networkRaw !== 'rsk_testnet' && networkRaw !== 'rsk_mainnet') {
    return { ok: false, error: 'network must be "rsk_testnet" or "rsk_mainnet"' }
  }

  return { ok: true, data: { address: addr, startBlock, network: networkRaw } }
}

function runCommand(cwd: string, command: string, args: string[]): { success: boolean; stderr: string; stdout: string } {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: false })
  return {
    success: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: '1mb' },
  },
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

  const { address, startBlock, network } = validated.data
  const template = TEMPLATES[network]
  const cwd = process.cwd()
  const templatePath = join(cwd, 'subgraph', template.dir)
  if (!existsSync(templatePath)) {
    return res.status(500).json({ error: `Subgraph template not found: subgraph/${template.dir}` })
  }

  let tempDir: string | null = null
  try {
    tempDir = mkdtempSync(join(tmpdir(), 'subgraph-prepare-'))
    cpSync(templatePath, tempDir, { recursive: true })

    const networksJson: Record<string, { TimelockController: { address: string; startBlock: number } }> = {
      [template.graphNetwork]: {
        TimelockController: { address, startBlock },
      },
    }
    writeFileSync(join(tempDir, 'networks.json'), JSON.stringify(networksJson, null, 2), 'utf8')

    const subgraphYamlPath = join(tempDir, 'subgraph.yaml')
    let yaml = readFileSync(subgraphYamlPath, 'utf8')
    yaml = yaml.replace(/address: "0x[a-fA-F0-9]+"/, `address: "${address}"`)
    yaml = yaml.replace(/startBlock: \d+/, `startBlock: ${startBlock}`)
    writeFileSync(subgraphYamlPath, yaml, 'utf8')

    let run = runCommand(tempDir, 'npm', ['install'])
    if (!run.success) {
      return res.status(500).json({
        error: `npm install failed: ${run.stderr.trim() || run.stdout.trim() || 'Unknown error'}`,
      })
    }
    run = runCommand(tempDir, 'npx', ['graph', 'codegen'])
    if (!run.success) {
      return res.status(500).json({
        error: `graph codegen failed: ${run.stderr.trim() || run.stdout.trim() || 'Unknown error'}`,
      })
    }
    run = runCommand(tempDir, 'npx', ['graph', 'build'])
    if (!run.success) {
      return res.status(500).json({
        error: `graph build failed: ${run.stderr.trim() || run.stdout.trim() || 'Unknown error'}`,
      })
    }

    const instructions = `# Deploy this subgraph to The Graph Studio

1. Authenticate (use your deploy key from https://thegraph.com/studio/):
   npx graph auth --studio <YOUR_DEPLOY_KEY>

2. Deploy (choose a unique slug for your subgraph):
   npx graph deploy --node https://api.studio.thegraph.com/deploy/ <YOUR_SLUG>

3. Copy the Query URL from the Studio dashboard and paste it in the Timelock Manager app when adding this timelock.
`
    writeFileSync(join(tempDir, 'DEPLOY_INSTRUCTIONS.txt'), instructions, 'utf8')

    const chunks: Buffer[] = []
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('error', (err: Error) => {
      throw err
    })
    archive.directory(tempDir, false)
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve())
      archive.on('error', reject)
      archive.finalize()
    })
    const zipBuffer = Buffer.concat(chunks)

    const addressShort = address.slice(0, 10)
    const filename = `subgraph-${network}-${addressShort}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(zipBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to prepare subgraph package'
    return res.status(500).json({ error: message })
  } finally {
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

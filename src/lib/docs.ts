const DEFAULT_DOCS_URL =
  'https://github.com/TruStartUp/timelock-manager/tree/main/docs'

export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL

export const SUBGRAPH_DOCS_URL = `${DOCS_URL}/advanced-topics/blockchain-indexing.md`

// src/types/timelock.ts

export type TimelockConfiguration = {
  id: string;
  name: string;
  address: `0x${string}`;
  network: 'rsk_mainnet' | 'rsk_testnet';
  subgraphUrl: string;
};

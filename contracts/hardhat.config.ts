import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, hardhatVerify],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    rootstockMainnet: {
      type: "http",
      chainType: "l1",
      url: "https://public-node.rsk.co",
      chainId: 30,
    },
    rootstockTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://public-node.testnet.rsk.co",
      chainId: 31,
    },
  },
  // Required for verify plugin: register Rootstock so "network not supported" is resolved (HHE40000 / HHE80000)
  chainDescriptors: {
    30: {
      name: "rootstockMainnet",
      blockExplorers: {
        blockscout: {
          name: "Blockscout",
          url: "https://rootstock.blockscout.com/",
          apiUrl: "https://rootstock.blockscout.com/api/",
        },
      },
    },
    31: {
      name: "rootstockTestnet",
      blockExplorers: {
        blockscout: {
          name: "Blockscout",
          url: "https://rootstock-testnet.blockscout.com/",
          apiUrl: "https://rootstock-testnet.blockscout.com/api/",
        },
      },
    },
  },
  verify: {
    etherscan: { enabled: false },
    sourcify: { enabled: false },
    blockscout: { enabled: true },
  } as Record<string, unknown>,
});

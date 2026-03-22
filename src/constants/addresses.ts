import { Address } from "viem";

export const TRADING_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B' as Address;
export const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0' as Address;
export const USDC_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b' as Address;
export const FAUCET_ADDRESS = '0x7cBC6673db27CE4B055C1004e92A2A04E446771b' as Address;

export const TRADING_ABI = [
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }, { internalType: "bytes", name: "oracleProof", type: "bytes" }], name: "openMarketPosition", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "bool", name: "isLimit", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "targetPrice", type: "uint48" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }], name: "placeOrder", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }], "name": "cancelOrder", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { inputs: [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }, { "internalType": "int32", "name": "lotsToClose", "type": "int32" }, { "internalType": "bytes", "name": "oracleProof", "type": "bytes" }], "name": "closePositionMarket", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { inputs: [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }, { "internalType": "uint64", "name": "amount6", "type": "uint64" }], "name": "addMargin", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { inputs: [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }, { "internalType": "uint48", "name": "newSL", "type": "uint48" }, { "internalType": "uint48", name: "newTP", "type": "uint48" }], "name": "updateSLTP", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

export const ERC20_ABI = [
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
] as const;

// J'ai fusionné les fonctions de trading (balances) et d'investissement (LP) du Vault
export const VAULT_ABI = [
  { inputs: [{ internalType: "uint256", name: "amount6", type: "uint256" }], name: "traderDeposit", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "uint256", name: "amount6", type: "uint256" }], name: "traderWithdraw", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "trader", type: "address" }], name: "getTraderTotalBalance", outputs: [{ internalType: "uint256", name: "total6", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "freeBalance", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { "inputs": [], "name": "currentEpoch", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "lpTokenPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "epochEquitySnapshot18", "outputs": [{ "internalType": "int256", "name": "", "type": "int256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getLpTotalCapital6", "outputs": [{ "internalType": "uint256", "name": "total6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lpFreeCapital", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lpLockedCapital", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "name": "pendingDepositOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "computeLpShares", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }, { "internalType": "uint256", "name": "pendingCurrentEpoch6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getLpEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getLpEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "e", "type": "uint256" }], "name": "getLpSharesForEpoch", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getWithdrawEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getWithdrawEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "userWithdraws", "outputs": [{ "internalType": "uint256", "name": "sharesRequested18", "type": "uint256" }, { "internalType": "uint256", "name": "usdWithdrawn6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "withdrawBuckets", "outputs": [{ "internalType": "uint256", "name": "totalSharesInitial18", "type": "uint256" }, { "internalType": "uint256", "name": "sharesRemaining18", "type": "uint256" }, { "internalType": "uint256", "name": "totalUsdAllocated6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "requestLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "reduceLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256[]", "name": "depositEpochs", "type": "uint256[]" }], "name": "requestLpWithdrawFromEpochs", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "requestEpoch", "type": "uint256" }], "name": "claimWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

export const FAUCET_ABI = [
  { inputs: [], name: "claim", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [ { internalType: "address", name: "", type: "address" } ], name: "hasClaimed", outputs: [ { internalType: "bool", name: "", type: "bool" } ], stateMutability: "view", type: "function" },
  { inputs: [ { internalType: "address", name: "user", type: "address" } ], name: "nextEligibleAt", outputs: [ { internalType: "uint256", name: "", type: "uint256" } ], stateMutability: "view", type: "function" },
] as const;
export const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11' as const;
export const TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b' as const;
export const TRADING_ADDRESS = '0x04a7cdf3b3aff0a0f84a94c48095d84baa91ec11' as const;

export const VAULT_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'balance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'available',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'locked',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'Deposit',
    type: 'event',
  },
] as const;

export const TOKEN_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const TRADING_ABI = [
  {
    inputs: [
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'bool', name: 'isLimit', type: 'bool' },
      { internalType: 'int64', name: 'priceX6', type: 'int64' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'open',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint32', name: 'id', type: 'uint32' },
      { internalType: 'int64', name: 'newSLx6', type: 'int64' },
      { internalType: 'int64', name: 'newTPx6', type: 'int64' },
    ],
    name: 'updateStops',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    name: 'close',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

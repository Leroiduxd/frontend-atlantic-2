export const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11' as const;
export const TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b' as const;
// ADRESSE TRADING INCHANGÉE
export const TRADING_ADDRESS = '0xb449fd01fa7937d146e867b995c261e33c619292' as const;

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

// NOUVELLE ABI TRADING MISE À JOUR
export const TRADING_ABI = [
  {
    inputs: [
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'int64', name: 'targetX6', type: 'int64' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'openLimit',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'openMarket',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // NOUVEAU : setSL
  {
		"inputs": [
			{ "internalType": "uint32", "name": "id", "type": "uint32" },
			{ "internalType": "int64", "name": "newSLx6", "type": "int64" }
		],
		"name": "setSL",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
  // NOUVEAU : setTP
	{
		"inputs": [
			{ "internalType": "uint32", "name": "id", "type": "uint32" },
			{ "internalType": "int64", "name": "newTPx6", "type": "int64" }
		],
		"name": "setTP",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
  // updateStops (conservé car il gère les deux à la fois, plus efficace)
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
  // NOUVEAU : closeMarket (remplace l'ancienne fonction 'close' qui était sans preuve)
  {
		"inputs": [
			{ "internalType": "uint32", "name": "id", "type": "uint32" },
			{ "internalType": "bytes", "name": "proof", "type": "bytes" }
		],
		"name": "closeMarket",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
  // Ancienne fonction 'close' (laissant pour compatibilité ou référence, mais 'closeMarket' sera utilisée)
  {
    inputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    name: 'close',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
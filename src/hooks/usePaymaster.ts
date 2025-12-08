import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';

// --- CONFIGURATION CONSTANTS ---
const API_BASE = "https://paymaster.brokex.trade";
const PAYMASTER_CONTRACT = "0x32da95857ea09Ec3347B59C4869f0D076E6a2957";

// ABI Spécifique pour le Paymaster (Domain + Nonces)
const PAYMASTER_ABI = [
  {
    inputs: [],
    name: "eip712Domain",
    outputs: [
      { internalType: "bytes1", name: "fields", type: "bytes1" },
      { internalType: "string", name: "name", type: "string" },
      { internalType: "string", name: "version", type: "string" },
      { internalType: "uint256", name: "chainId", type: "uint256" },
      { internalType: "address", name: "verifyingContract", type: "address" },
      { internalType: "bytes32", name: "salt", type: "bytes32" },
      { internalType: "uint256[]", name: "extensions", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// EIP-712 Type Definitions (Updated with all actions)
const TYPES = {
  MarketOpen: [
    { name: "trader", type: "address" }, { name: "assetId", type: "uint32" },
    { name: "longSide", type: "bool" }, { name: "leverageX", type: "uint16" },
    { name: "lots", type: "uint16" }, { name: "slX6", type: "int64" },
    { name: "tpX6", type: "int64" }, { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  LimitOpen: [
    { name: "trader", type: "address" }, { name: "assetId", type: "uint32" },
    { name: "longSide", type: "bool" }, { name: "leverageX", type: "uint16" },
    { name: "lots", type: "uint16" }, { name: "targetX6", type: "int64" },
    { name: "slX6", type: "int64" }, { name: "tpX6", type: "int64" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
  ],
  MarketClose: [
    { name: "trader", type: "address" }, { name: "id", type: "uint32" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
  ],
  LimitCancel: [
    { name: "trader", type: "address" }, { name: "id", type: "uint32" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
  ],
  LimitUpdateStops: [
    { name: "trader", type: "address" }, { name: "id", type: "uint32" },
    { name: "newSLx6", type: "int64" }, { name: "newTPx6", type: "int64" },
    { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
  ]
} as const;

// --- INPUT TYPES ---

// 1. OPEN (Existing)
export interface PaymasterOpenParams {
  type: 'open';
  assetId: number;
  longSide: boolean;
  leverage: number;
  lots: number;
  orderType: 'limit' | 'market';
  price?: number; // Requis pour Limit
  slPrice?: number;
  tpPrice?: number;
}

// 2. CLOSE POSITION
export interface PaymasterCloseParams {
  type: 'close';
  positionId: number; // ID on-chain de la position
  assetId: number;    // Requis pour récupérer la preuve de prix
}

// 3. CANCEL ORDER
export interface PaymasterCancelParams {
  type: 'cancel';
  orderId: number;    // ID on-chain de l'ordre limit
}

// 4. UPDATE SL/TP
export interface PaymasterUpdateParams {
  type: 'update';
  id: number;         // Position ID ou Order ID
  slPrice?: number;
  tpPrice?: number;
}

// Union Type pour gérer toutes les requêtes
export type PaymasterReq = PaymasterOpenParams | PaymasterCloseParams | PaymasterCancelParams | PaymasterUpdateParams;


export const usePaymaster = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const toX6 = (val?: number) => {
    if (!val || isNaN(val)) return BigInt(0);
    return BigInt(Math.round(val * 1_000_000));
  };

  const executeGaslessAction = useCallback(async (params: PaymasterReq) => {
    if (!address || !walletClient || !publicClient) {
      throw new Error("Wallet not initialized");
    }

    setIsLoading(true);
    try {
      // 1. Récupérer le Domain EIP712
      const [fields, name, version, chainId, verifyingContract, salt, extensions] = await publicClient.readContract({
        address: PAYMASTER_CONTRACT,
        abi: PAYMASTER_ABI,
        functionName: 'eip712Domain',
      });

      const domain = {
        name,
        version,
        chainId: Number(chainId),
        verifyingContract,
      };

      // 2. Récupérer le Nonce
      const nonce = await publicClient.readContract({
        address: PAYMASTER_CONTRACT,
        abi: PAYMASTER_ABI,
        functionName: 'nonces',
        args: [address],
      });

      // 3. Setup commun
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1h validité
      
      let types;
      let primaryType: string;
      let message: any;
      let endpoint: string;
      let apiBody: any = { trader: address, deadline: deadline.toString(), nonce: nonce.toString() };

      // ---------------------------------------------------------
      // SWITCH LOGIC BASED ON ACTION TYPE
      // ---------------------------------------------------------

      if (params.type === 'open') {
        // --- LOGIQUE OPEN (Existante) ---
        const slX6 = toX6(params.slPrice);
        const tpX6 = toX6(params.tpPrice);

        message = {
          trader: address,
          assetId: params.assetId,
          longSide: params.longSide,
          leverageX: params.leverage,
          lots: params.lots,
          slX6,
          tpX6,
          nonce,
          deadline,
        };

        if (params.orderType === 'limit') {
            if (!params.price) throw new Error("Price required for limit order");
            types = { LimitOpen: TYPES.LimitOpen };
            primaryType = "LimitOpen";
            endpoint = "/limit";
            message.targetX6 = toX6(params.price);
            apiBody.targetX6 = message.targetX6.toString();
        } else {
            types = { MarketOpen: TYPES.MarketOpen };
            primaryType = "MarketOpen";
            endpoint = "/open";
        }

        // Add params to API Body
        apiBody = { ...apiBody, assetId: params.assetId, longSide: params.longSide, leverageX: params.leverage, lots: params.lots, slX6: slX6.toString(), tpX6: tpX6.toString() };

      } else if (params.type === 'close') {
        // --- LOGIQUE CLOSE ---
        types = { MarketClose: TYPES.MarketClose };
        primaryType = "MarketClose";
        endpoint = "/close";
        
        message = {
            trader: address,
            id: params.positionId,
            nonce,
            deadline
        };
        
        // L'API attend "positionId" mais le contrat signe "id"
        apiBody = { ...apiBody, positionId: params.positionId, assetId: params.assetId };

      } else if (params.type === 'cancel') {
        // --- LOGIQUE CANCEL ---
        types = { LimitCancel: TYPES.LimitCancel };
        primaryType = "LimitCancel";
        endpoint = "/cancel";

        message = {
            trader: address,
            id: params.orderId,
            nonce,
            deadline
        };

        apiBody = { ...apiBody, id: params.orderId };

      } else if (params.type === 'update') {
        // --- LOGIQUE UPDATE STOPS ---
        // On utilise LimitUpdateStops pour tout gérer (SL, TP ou les deux)
        types = { LimitUpdateStops: TYPES.LimitUpdateStops };
        primaryType = "LimitUpdateStops";
        endpoint = "/update-stops";

        const newSLx6 = toX6(params.slPrice);
        const newTPx6 = toX6(params.tpPrice);

        message = {
            trader: address,
            id: params.id,
            newSLx6,
            newTPx6,
            nonce,
            deadline
        };

        apiBody = { ...apiBody, id: params.id, newSLx6: newSLx6.toString(), newTPx6: newTPx6.toString() };
      } else {
          throw new Error("Unknown action type");
      }

      // 4. Signer (Wallet Popup) 
      console.log(`Signing ${primaryType}...`, message);
      
      // @ts-ignore - dynamic types inference can be tricky here but safe
      const signature = await walletClient.signTypedData({
        account: address,
        domain,
        types,
        primaryType,
        message,
      });

      // 5. Envoyer à l'API
      apiBody.signature = signature;
      
      console.log(`Sending to API: ${API_BASE}${endpoint}`, apiBody);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Paymaster API Failed");
      }

      return data.txHash as string;

    } catch (error) {
      console.error("Paymaster Error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient]);

  // Alias pour la compatibilité avec OrderPanel (on map les params existants vers le nouveau type 'open')
  const executeGaslessOrder = useCallback((params: Omit<PaymasterOpenParams, 'type'>) => {
      return executeGaslessAction({ ...params, type: 'open' });
  }, [executeGaslessAction]);

  return { 
      executeGaslessOrder, // Ancien nom pour compatibilité
      executeGaslessAction, // Nouveau nom générique
      isLoading 
  };
};
import { useState } from 'react';
import { useAccount, useSignTypedData, usePublicClient } from 'wagmi';
import { Hash } from 'viem';

// --- CONFIGURATION ---
const API_BASE_URL = "https://paymaster.brokex.trade";
const PAYMASTER_ADDRESS = "0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B" as const;
const CHAIN_ID = 688689;

const DOMAIN = {
    name: "BrokexPaymaster",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: PAYMASTER_ADDRESS
} as const;

// --- TYPES EIP-712 ---
const TYPES = {
    OpenMarket: [
        { name: "trader", type: "address" }, { name: "assetId", type: "uint32" }, { name: "isLong", type: "bool" },
        { name: "leverage", type: "uint8" }, { name: "lotSize", type: "int32" }, { name: "stopLoss", type: "uint48" },
        { name: "takeProfit", type: "uint48" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ],
    PlaceOrder: [
        { name: "trader", type: "address" }, { name: "assetId", type: "uint32" }, { name: "isLong", type: "bool" },
        { name: "isLimit", type: "bool" }, { name: "leverage", type: "uint8" }, { name: "lotSize", type: "int32" },
        { name: "targetPrice", type: "uint48" }, { name: "stopLoss", type: "uint48" }, { name: "takeProfit", type: "uint48" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ],
    CloseMarket: [
        { name: "trader", type: "address" }, { name: "tradeId", type: "uint256" }, { name: "lotsToClose", type: "int32" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ],
    UpdateSLTP: [
        { name: "trader", type: "address" }, { name: "tradeId", type: "uint256" }, { name: "newSL", type: "uint48" },
        { name: "newTP", type: "uint48" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ],
    AddMargin: [
        { name: "trader", type: "address" }, { name: "tradeId", type: "uint256" }, { name: "amount6", type: "uint64" },
        { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ],
    CancelOrder: [
        { name: "trader", type: "address" }, { name: "tradeId", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }
    ]
} as const;

export const usePaymaster = () => {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { signTypedDataAsync } = useSignTypedData();
    
    const [isLoading, setIsLoading] = useState(false);

    // Fonction utilitaire pour récupérer le nonce sur le contrat
    const getNonce = async (traderAddress: string): Promise<bigint> => {
        if (!publicClient) throw new Error("Public client not initialized");
        const nonce = await publicClient.readContract({
            address: PAYMASTER_ADDRESS,
            abi: [{
                name: 'nonces',
                type: 'function',
                inputs: [{ name: 'trader', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'nonces',
            args: [traderAddress as `0x${string}`]
        });
        return nonce as bigint;
    };

    // Moteur générique centralisé
    const executeGaslessTransaction = async (
        endpoint: string, 
        typeName: keyof typeof TYPES, 
        params: Record<string, any>
    ): Promise<Hash> => {
        if (!address) throw new Error("Wallet not connected");
        setIsLoading(true);

        try {
            const nonce = await getNonce(address);
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 7200); // Valide 2h

            const message = {
                trader: address,
                nonce,
                deadline,
                ...params
            };

            // 1. Demande de signature via Wagmi / RainbowKit
            const signature = await signTypedDataAsync({
                domain: DOMAIN,
                types: { [typeName]: TYPES[typeName] },
                primaryType: typeName,
                message: message
            });

            // 2. Formatage pour l'API (Conversion des BigInt en strings)
            const payload = {
                ...message,
                nonce: nonce.toString(),
                deadline: deadline.toString(),
                signature
            };

            // 3. Appel API
            const response = await fetch(`${API_BASE_URL}/execute/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.error || "Paymaster API Error");
            }

            return result.txHash as Hash;
        } catch (error) {
            console.error(`Paymaster error [${endpoint}]:`, error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // --- LES 6 FONCTIONS EXPOSÉES ---

    const executeOpenMarket = async (params: { assetId: number, isLong: boolean, leverage: number, lotSize: number, stopLoss: number, takeProfit: number }) => {
        return executeGaslessTransaction("openMarket", "OpenMarket", params);
    };

    const executePlaceOrder = async (params: { assetId: number, isLong: boolean, isLimit: boolean, leverage: number, lotSize: number, targetPrice: number, stopLoss: number, takeProfit: number }) => {
        return executeGaslessTransaction("placeOrder", "PlaceOrder", params);
    };

    const executeCloseMarket = async (params: { tradeId: number, assetId: number, lotsToClose: number }) => {
        return executeGaslessTransaction("closeMarket", "CloseMarket", params);
    };

    const executeUpdateSLTP = async (params: { tradeId: number, newSL: number, newTP: number }) => {
        return executeGaslessTransaction("updateSLTP", "UpdateSLTP", params);
    };

    const executeAddMargin = async (params: { tradeId: number, amount6: number }) => {
        return executeGaslessTransaction("addMargin", "AddMargin", params);
    };

    const executeCancelOrder = async (params: { tradeId: number }) => {
        return executeGaslessTransaction("cancelOrder", "CancelOrder", params);
    };

    return {
        isLoading,
        executeOpenMarket,
        executePlaceOrder,
        executeCloseMarket,
        executeUpdateSLTP,
        executeAddMargin,
        executeCancelOrder
    };
};
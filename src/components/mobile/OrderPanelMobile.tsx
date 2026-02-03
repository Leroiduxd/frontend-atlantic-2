// components/mobile/OrderPanelMobile.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault"; 
import { useToast } from "@/hooks/use-toast";
import { Asset } from "../ChartControls"; 
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { useWriteContract, useAccount, usePublicClient, useReadContracts } from 'wagmi';
import { ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react'; 
import { Hash, formatUnits } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketClosedBanner } from "../MarketClosedBanner";

// --- CONSTANTES ---
const TRADING_ADDRESS = '0x0afFdf07Cad8B950b823d8C953ee3d986a9A5FbC' as const;
const VAULT_ADDRESS = '0xFebf0c9421f70041FbD3410ECE47D080f03fC7EE' as const;

const TRADING_ABI = [
    {
        inputs: [
            { internalType: "uint32", name: "assetId", type: "uint32" },
            { internalType: "bool", name: "isLong", type: "bool" },
            { internalType: "uint8", name: "leverage", type: "uint8" },
            { internalType: "int32", name: "lotSize", type: "int32" },
            { internalType: "uint48", name: "stopLoss", type: "uint48" },
            { internalType: "uint48", name: "takeProfit", type: "uint48" },
            { internalType: "bytes", name: "oracleProof", type: "bytes" }
        ],
        name: "openMarketPosition",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint32", name: "assetId", type: "uint32" },
            { internalType: "bool", name: "isLong", type: "bool" },
            { internalType: "bool", name: "isLimit", type: "bool" },
            { internalType: "uint8", name: "leverage", type: "uint8" },
            { internalType: "int32", name: "lotSize", type: "int32" },
            { internalType: "uint48", name: "targetPrice", type: "uint48" },
            { internalType: "uint48", name: "stopLoss", type: "uint48" },
            { internalType: "uint48", name: "takeProfit", type: "uint48" }
        ],
        name: "placeOrder",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;

const VAULT_ABI = [
    {
        inputs: [{ internalType: "address", name: "trader", type: "address" }],
        name: "getTraderTotalBalance",
        outputs: [{ internalType: "uint256", name: "total6", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "freeBalance",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

// --- UTILS ---
type OrderType = "limit" | "market" | "stop";

const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch proof`);
    const data = await response.json();
    return data.proof as Hash;
};

// --- COMPOSANT STEP CONTROLLER ---
interface StepControllerProps {
    value: string | number;
    onChange: (value: any) => void;
    step: number;
    min?: number;
    max?: number;
    decimals?: number;
    label?: string;
}

const StepController: React.FC<StepControllerProps> = ({
    value, onChange, step, min = 0, max = Infinity, decimals = 2, label
}) => {
    const handleStep = (delta: number) => {
        const numericValue = Number(value);
        const newValue = Math.min(max, Math.max(min, numericValue + delta));
        onChange(Number(newValue.toFixed(decimals)));
    };

    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{label}</span>}
            <div className="relative flex items-center h-12">
                <Button 
                    variant="outline" 
                    className="h-full w-12 rounded-l-lg rounded-r-none border-r-0 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    onClick={() => handleStep(-step)}
                >
                    <ChevronDown className="w-5 h-5 text-slate-600 dark:text-zinc-400" />
                </Button>
                
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-full text-center rounded-none border-x-0 bg-white dark:bg-black dark:border-zinc-700 text-lg font-mono focus-visible:ring-0"
                />
                
                <Button 
                    variant="outline" 
                    className="h-full w-12 rounded-r-lg rounded-l-none border-l-0 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    onClick={() => handleStep(step)}
                >
                    <ChevronUp className="w-5 h-5 text-slate-600 dark:text-zinc-400" />
                </Button>
            </div>
        </div>
    );
};

// --- PROPS ---
interface OrderPanelMobileProps {
    selectedAsset: Asset;
    currentPrice: number;
    onClose?: () => void;
    side: "long" | "short"; // Pour forcer le style Bleu ou Rouge
}

// --- MAIN COMPONENT ---
export const OrderPanelMobile = ({
    selectedAsset,
    currentPrice,
    onClose,
    side
}: OrderPanelMobileProps) => {

    // States
    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [leverage, setLeverage] = useState(10);
    const [lotsDisplay, setLotsDisplay] = useState(1);
    const [limitPrice, setLimitPrice] = useState('');
    const [tpPrice, setTpPrice] = useState('');
    const [slPrice, setSlPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Hooks
    const { refetchAll: refetchVault } = useVault();
    const { getConfigById } = useAssetConfig();
    const { address, chain: currentChain } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { toast } = useToast();
    const publicClient = usePublicClient({ chainId: currentChain?.id });

    // --- LECTURE BALANCES (WAGMI) ---
    const { data: balanceData, refetch: refetchBalances } = useReadContracts({
        contracts: [
            {
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'getTraderTotalBalance',
                args: address ? [address] : undefined,
            },
            {
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: 'freeBalance',
                args: address ? [address] : undefined,
            }
        ],
        query: {
            enabled: !!address,
            refetchInterval: 5000 
        }
    });

    const totalBalanceVal = balanceData?.[0]?.result ? Number(formatUnits(balanceData[0].result, 6)) : 0;
    const availableBalanceVal = balanceData?.[1]?.result ? Number(formatUnits(balanceData[1].result, 6)) : 0;

    // Asset ID Logic
    const finalAssetIdForTx = useMemo(() => {
        const id = Number(selectedAsset.id);
        return (isNaN(id) || id < 0) ? 0 : id;
    }, [selectedAsset.id]);

    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    // Auto-switch limit if closed
    useEffect(() => {
        if (!isMarketOpen && orderType === "market") setOrderType("limit");
    }, [isMarketOpen, orderType]);

    // Config & Decimals
    const assetConfig = getConfigById(finalAssetIdForTx);
    const { priceDecimals, priceStep } = useMemo(() => {
        const decimals = Math.max(0, Math.round(Math.log10(1000000 / (assetConfig?.tick_size_usd6 || 10000))));
        return {
            priceDecimals: decimals,
            priceStep: 1 / (10 ** decimals),
        };
    }, [assetConfig]);

    useEffect(() => {
        if (currentPrice > 0 && (orderType === 'limit' || orderType === 'stop')) {
            setLimitPrice(currentPrice.toFixed(priceDecimals));
        }
    }, [selectedAsset.id, currentPrice, priceDecimals, orderType]);

    // Calculations
    const calculations = useMemo(() => {
        const price = (orderType === 'limit' || orderType === 'stop') && limitPrice ? Number(limitPrice) : currentPrice;
        
        if (isNaN(price) || price <= 0 || lotsDisplay <= 0) return { value: 0, cost: 0, commission: 0 };
        
        const displayNotional = lotsDisplay * price; 
        const commissionRate = 0.001; 

        return {
            value: displayNotional,
            cost: displayNotional / leverage,
            commission: displayNotional * commissionRate,
        };
    }, [lotsDisplay, leverage, limitPrice, currentPrice, orderType]);

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // --- TRADE HANDLER ---
    const handleTrade = async () => {
        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        
        const requiredMargin = calculations.cost * 1.01;
        if (availableBalanceVal < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        setIsSubmitting(true);
        let txHash: Hash | string | undefined;

        try {
            const actualLots = Number(lotsDisplay);
            const numLimitPrice = Number(limitPrice);
            const isLong = side === 'long';
            
            // Conversion 1e6
            const slX6 = slEnabled && slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
            const tpX6 = tpEnabled && tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;

            if (orderType === 'limit' || orderType === 'stop') {
                const isLimit = orderType === 'limit'; 
                const targetPriceX6 = Math.round(numLimitPrice * 1000000);

                txHash = await writeContractAsync({
                    address: TRADING_ADDRESS, 
                    abi: TRADING_ABI, 
                    functionName: 'placeOrder',
                    args: [
                        finalAssetIdForTx, 
                        isLong, 
                        isLimit, 
                        leverage, 
                        actualLots, 
                        BigInt(targetPriceX6), 
                        BigInt(slX6), 
                        BigInt(tpX6)
                    ],
                });
            } else {
                const proof = await getMarketProof(finalAssetIdForTx);
                txHash = await writeContractAsync({
                    address: TRADING_ADDRESS, 
                    abi: TRADING_ABI, 
                    functionName: 'openMarketPosition',
                    args: [
                        finalAssetIdForTx, 
                        isLong, 
                        leverage, 
                        actualLots, 
                        BigInt(slX6), 
                        BigInt(tpX6), 
                        proof
                    ],
                });
            }
            
            if (publicClient && txHash) await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });

            toast({ title: 'Order Placed', description: `${isLong ? 'Buy' : 'Sell'} order successful.` });
            refetchVault();
            refetchBalances();
            if(onClose) onClose();

        } catch (e: any) {
            console.error(e);
            toast({ title: 'Order failed', description: e.message || "An error occurred", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- COULEUR DU THEME (Rouge ou Bleu) ---
    const themeColor = side === 'long' ? 'blue' : 'red'; // Changement ici : Bleu pour Long, Rouge pour Short
    // Note: Dans ta demande c'était "Rouge et Bleu". Standard trading : Long = Vert (ou Bleu), Short = Rouge.
    // J'utilise ici : Long = Bleu (#3b82f6), Short = Rouge (#ef4444).

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black text-slate-900 dark:text-white">
            
            {/* HEADER DU SHEET */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex flex-col">
                    <span className={`text-lg font-bold ${side === 'long' ? 'text-blue-600' : 'text-red-600'}`}>
                        {side === 'long' ? 'Buy Long' : 'Sell Short'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
                        {selectedAsset.symbol} @ {Number(currentPrice).toFixed(priceDecimals)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 rounded-md px-2 py-1">
                        <span className="text-xs font-bold">{leverage}x</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* CONTENU SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* 1. Market Status Banner */}
                <MarketClosedBanner status={marketStatus} />

                {/* 2. Balance Info */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Available</span>
                        <span className="text-sm font-mono font-bold">${formatUSD(availableBalanceVal)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Total</span>
                        <span className="text-sm font-mono font-bold">${formatUSD(totalBalanceVal)}</span>
                    </div>
                </div>

                {/* 3. Order Type Tabs */}
                <div className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl flex">
                    {(['limit', 'market', 'stop'] as OrderType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => isMarketOpen && setOrderType(type)}
                            disabled={type === 'market' && !isMarketOpen}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg transition-all duration-200
                                ${orderType === type 
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' 
                                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 disabled:opacity-50'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* 4. Leverage Slider (Accent adapté au side) */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
                        <span>Leverage</span>
                        <span className="text-slate-900 dark:text-white font-bold">{leverage}x</span>
                    </div>
                    <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={leverage} 
                        onChange={(e) => setLeverage(Number(e.target.value))}
                        className={`w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer 
                            ${side === 'long' ? 'accent-blue-600' : 'accent-red-600'}
                        `}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>1x</span>
                        <span>50x</span>
                        <span>100x</span>
                    </div>
                </div>

                {/* 5. Inputs (Lots & Price) */}
                <div className="space-y-4">
                    {(orderType === "limit" || orderType === "stop") && (
                        <StepController 
                            label={`Price (USD)`}
                            value={limitPrice} 
                            onChange={setLimitPrice} 
                            step={priceStep} 
                            decimals={priceDecimals} 
                        />
                    )}

                    <StepController 
                        label={`Size (Lots)`}
                        value={lotsDisplay} 
                        onChange={setLotsDisplay} 
                        step={1} 
                        min={1} 
                        decimals={0} 
                    />
                </div>

                {/* 6. TP / SL */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox 
                                id="tp" 
                                checked={tpEnabled} 
                                onCheckedChange={(c) => setTpEnabled(!!c)} 
                                className="dark:border-zinc-600"
                            />
                            <label htmlFor="tp" className="text-xs font-bold uppercase text-slate-500">Take Profit</label>
                        </div>
                        {tpEnabled && (
                            <Input 
                                type="number" 
                                placeholder="TP Price" 
                                value={tpPrice} 
                                onChange={(e) => setTpPrice(e.target.value)}
                                className="h-10 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox 
                                id="sl" 
                                checked={slEnabled} 
                                onCheckedChange={(c) => setSlEnabled(!!c)} 
                                className="dark:border-zinc-600"
                            />
                            <label htmlFor="sl" className="text-xs font-bold uppercase text-slate-500">Stop Loss</label>
                        </div>
                        {slEnabled && (
                            <Input 
                                type="number" 
                                placeholder="SL Price" 
                                value={slPrice} 
                                onChange={(e) => setSlPrice(e.target.value)}
                                className="h-10 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        )}
                    </div>
                </div>

                {/* 7. Summary Box */}
                <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-4 space-y-2 text-xs border border-slate-100 dark:border-zinc-800">
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-zinc-500">Notional Value</span>
                        <span className="font-mono">${formatUSD(calculations.value)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span className="text-slate-500 dark:text-zinc-500">Margin Cost</span>
                        <span className="font-mono text-slate-900 dark:text-white">${formatUSD(calculations.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-zinc-500">Est. Fee</span>
                        <span className="font-mono text-slate-900 dark:text-white">${formatUSD(calculations.commission)}</span>
                    </div>
                </div>
            </div>

            {/* 8. Action Button (Couleur Adaptée) */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-black pb-safe">
                <Button 
                    onClick={() => handleTrade(side === 'long')} 
                    disabled={isSubmitting}
                    className={`w-full h-12 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.98]
                        ${side === 'long' 
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                            : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                        }
                    `}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (side === 'long' ? 'Confirm Buy / Long' : 'Confirm Sell / Short')}
                </Button>
            </div>
        </div>
    );
};
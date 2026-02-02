"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault";
import { useToast } from "@/hooks/use-toast";
import { Asset } from "./ChartControlsMobile"; 
import { useAssetConfig } from "@/hooks/useAssetConfig";
// ❌ Import supprimé : MarketClosedBanner
import { useWriteContract, useAccount, usePublicClient } from 'wagmi';
import { usePaymaster } from "@/hooks/usePaymaster";
import { ChevronUp, ChevronDown, Fuel, X } from 'lucide-react'; 
import { Hash } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";

// --- CONSTANTES & TYPES ---
const TRADING_ADDRESS = '0xED853d3fD0da9b6c218124407419a47e5F9d8cC3' as const;
const TRADING_ABI = [
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
    }
] as const;

type OrderType = "limit" | "market" | "stop";

// --- HELPER FETCH PROOF ---
const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch proof`);
    const data = await response.json();
    return data.proof as Hash;
};

// --- COMPOSANT STEP CONTROLLER (Mobile Optimized) ---
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
    const numericValue = Number(value);
    
    const handleStep = (delta: number) => {
        const newValue = Math.min(max, Math.max(min, numericValue + delta));
        onChange(Number(newValue.toFixed(decimals)));
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && <span className="text-xs text-slate-500 dark:text-zinc-500">{label}</span>}
            <div className="relative flex items-center">
                <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-l-lg rounded-r-none border-r-0 dark:bg-zinc-900 dark:border-zinc-800"
                    onClick={() => handleStep(-step)}
                >
                    <ChevronDown className="w-4 h-4" />
                </Button>
                
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-12 text-center rounded-none border-x-0 dark:bg-zinc-900 dark:border-zinc-800 text-lg font-mono focus-visible:ring-0"
                />
                
                <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-r-lg rounded-l-none border-l-0 dark:bg-zinc-900 dark:border-zinc-800"
                    onClick={() => handleStep(step)}
                >
                    <ChevronUp className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

// --- PROPS ---
interface OrderPanelMobileProps {
    selectedAsset: Asset;
    currentPrice: number;
    paymasterEnabled: boolean;
    onTogglePaymaster: () => void;
    side: "long" | "short";
    onClose: () => void;
}

// --- COMPOSANT PRINCIPAL ---
export const OrderPanelMobile = ({
    selectedAsset,
    currentPrice,
    paymasterEnabled,
    onTogglePaymaster,
    side,
    onClose
}: OrderPanelMobileProps) => {

    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [leverage, setLeverage] = useState(10);
    const [lotsDisplay, setLotsDisplay] = useState(0.01);
    const [limitPrice, setLimitPrice] = useState('');
    const [tpPrice, setTpPrice] = useState('');
    const [slPrice, setSlPrice] = useState('');
    const [localLoading, setLocalLoading] = useState(false);

    const { available, refetchAll } = useVault();
    const { getConfigById, convertDisplayToLots } = useAssetConfig();
    const { chain: currentChain } = useAccount();
    const { executeGaslessOrder, isLoading: paymasterLoading } = usePaymaster();
    const { writeContractAsync } = useWriteContract();
    const { toast } = useToast();
    const publicClient = usePublicClient({ chainId: currentChain?.id });

    const loading = localLoading || paymasterLoading;
    const finalAssetIdForTx = useMemo(() => Number(selectedAsset.id) || -1, [selectedAsset.id]);
    
    // On garde juste la logique pour savoir si c'est ouvert, mais on n'affiche plus la bannière
    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    // Auto-switch to limit if market closed
    useEffect(() => {
        if (!isMarketOpen && orderType === "market") setOrderType("limit");
    }, [isMarketOpen, orderType]);

    // Initial Config
    const assetConfig = getConfigById(finalAssetIdForTx);
    const { minLotSizeDisplay, lotStep, priceDecimals, priceStep } = useMemo(() => {
        const lotSize = (assetConfig?.lot_num || 1) / (assetConfig?.lot_den || 100);
        const decimals = Math.max(0, Math.round(Math.log10(1000000 / (assetConfig?.tick_size_usd6 || 10000))));
        return {
            minLotSizeDisplay: lotSize,
            lotStep: lotSize,
            priceDecimals: decimals,
            priceStep: 1 / (10 ** decimals),
        };
    }, [assetConfig]);

    useEffect(() => {
        setLotsDisplay(minLotSizeDisplay);
        if (currentPrice > 0 && (orderType === 'limit' || orderType === 'stop')) {
            setLimitPrice(currentPrice.toFixed(priceDecimals));
        }
    }, [selectedAsset.id, currentPrice, minLotSizeDisplay, priceDecimals, orderType]);

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

    const formatPrice = (value: number) => value === 0 ? "0.00" : value.toFixed(priceDecimals > 5 ? 5 : priceDecimals || 2);

    // Trade Handler
    const handleTrade = async () => {
        const longSide = side === "long";

        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        const numLimitPrice = Number(limitPrice);
        const numSlPrice = slEnabled ? Number(slPrice) : undefined;
        const numTpPrice = tpEnabled ? Number(tpPrice) : undefined;
        const requiredMargin = calculations.cost * 1.01;

        if (Number(available) < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        if (!paymasterEnabled) setLocalLoading(true);
        let txHash: Hash | string | undefined;

        try {
            const actualLots = convertDisplayToLots(lotsDisplay, finalAssetIdForTx);
            if (paymasterEnabled) {
                txHash = await executeGaslessOrder({
                    assetId: finalAssetIdForTx, 
                    longSide, 
                    leverage, 
                    lots: actualLots, 
                    orderType: orderType === 'stop' ? 'limit' : orderType, 
                    price: (orderType === 'limit' || orderType === 'stop') ? numLimitPrice : undefined, 
                    slPrice: numSlPrice, 
                    tpPrice: numTpPrice,
                });
            } else {
                const slX6 = numSlPrice ? Math.round(numSlPrice * 1000000) : 0;
                const tpX6 = numTpPrice ? Math.round(numTpPrice * 1000000) : 0;
                
                if (orderType === 'limit' || orderType === 'stop') {
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, abi: TRADING_ABI, functionName: 'openLimit',
                        args: [finalAssetIdForTx, longSide, leverage, actualLots, BigInt(Math.round(numLimitPrice * 1000000)), BigInt(slX6), BigInt(tpX6)],
                    });
                } else {
                    const proof = await getMarketProof(finalAssetIdForTx);
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, abi: TRADING_ABI, functionName: 'openMarket',
                        args: [proof, finalAssetIdForTx, longSide, leverage, actualLots, BigInt(slX6), BigInt(tpX6)],
                    });
                }
                if (publicClient && txHash) await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
            }

            toast({ title: 'Order Placed', description: `${longSide ? 'Buy' : 'Sell'} order successful.` });
            refetchAll();
            onClose();
        } catch (e: any) {
            toast({ title: 'Order failed', description: e.message, variant: "destructive" });
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black text-slate-900 dark:text-white">
            
            {/* HEADER DU SHEET */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex flex-col">
                    <span className={`text-lg font-bold ${side === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                        {side === 'long' ? 'Buy Long' : 'Sell Short'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
                        {selectedAsset.symbol} @ {formatPrice(currentPrice)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 rounded-md px-2 py-1">
                        <span className="text-xs font-bold">{leverage}x</span>
                    </div>
                    {/* Paymaster Toggle */}
                    <button 
                        onClick={onTogglePaymaster}
                        className={`p-2 rounded-md transition-colors ${paymasterEnabled ? 'bg-amber-400 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}
                    >
                        <Fuel className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* CONTENU SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* 1. Order Type + Leverage Slider */}
                <div className="space-y-4">
                    <div className="p-1 bg-slate-100 dark:bg-zinc-900 rounded-lg flex">
                        {(['limit', 'market', 'stop'] as OrderType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => isMarketOpen && setOrderType(type)}
                                disabled={type === 'market' && !isMarketOpen}
                                className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all
                                    ${orderType === type 
                                        ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' 
                                        : 'text-slate-500 dark:text-zinc-500 disabled:opacity-50'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span>Leverage</span>
                            <span className="font-bold">{leverage}x</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={leverage} 
                            onChange={(e) => setLeverage(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>

                {/* 2. Inputs Principaux */}
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
                        label={`Amount (${selectedAsset.symbol.split('/')[0]})`}
                        value={lotsDisplay} 
                        onChange={setLotsDisplay} 
                        step={lotStep} 
                        min={minLotSizeDisplay} 
                        decimals={lotStep >= 1 ? 0 : 2} 
                    />
                </div>

                {/* 3. TP / SL */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox 
                                id="tp" 
                                checked={tpEnabled} 
                                onCheckedChange={(c) => setTpEnabled(!!c)} 
                                className="dark:border-zinc-600"
                            />
                            <label htmlFor="tp" className="text-sm font-medium">Take Profit</label>
                        </div>
                        {tpEnabled && (
                            <Input 
                                type="number" 
                                placeholder="TP Price" 
                                value={tpPrice} 
                                onChange={(e) => setTpPrice(e.target.value)}
                                className="dark:bg-zinc-900 dark:border-zinc-800"
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
                            <label htmlFor="sl" className="text-sm font-medium">Stop Loss</label>
                        </div>
                        {slEnabled && (
                            <Input 
                                type="number" 
                                placeholder="SL Price" 
                                value={slPrice} 
                                onChange={(e) => setSlPrice(e.target.value)}
                                className="dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        )}
                    </div>
                </div>

                {/* 4. Résumé Cost */}
                <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Notional Value</span>
                        <span className="font-mono">${formatPrice(calculations.value)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span className="text-slate-500">Margin Cost</span>
                        <span className="font-mono text-slate-900 dark:text-white">${formatPrice(calculations.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Fee (est.)</span>
                        <span className="font-mono text-slate-900 dark:text-white">${formatPrice(calculations.commission)}</span>
                    </div>
                </div>
            </div>

            {/* FOOTER : Action Button */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-black pb-safe">
                <Button 
                    onClick={handleTrade} 
                    disabled={loading}
                    className={`w-full h-12 text-lg font-bold text-white shadow-lg transition-transform active:scale-[0.98]
                        ${loading ? 'bg-zinc-500' : side === 'long' ? 'bg-[#2ebd85] hover:bg-[#2ebd85]/90 shadow-green-500/20' : 'bg-[#f6465d] hover:bg-[#f6465d]/90 shadow-red-500/20'}
                    `}
                >
                    {loading ? 'Processing...' : side === 'long' ? 'Confirm Buy' : 'Confirm Sell'}
                </Button>
                <div className="text-center mt-2 text-[10px] text-slate-400">
                    Available Balance: ${available}
                </div>
            </div>
        </div>
    );
};
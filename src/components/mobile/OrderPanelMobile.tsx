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
import { usePaymaster } from "@/hooks/useBrokexPaymaster"; 
import { ChevronDown, Loader2, Fuel, CandlestickChart, Wallet } from 'lucide-react'; 
import { Hash, formatUnits } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketClosedBanner } from "../MarketClosedBanner";

const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

const ALLOWED_LEVERAGES = [1, 2, 3, 5, 10, 20, 25, 50, 100];

const ASSET_MAX_LEVERAGE: Record<number, number> = {
    0: 20, 1: 20, 10: 10, 5: 10, 2: 10, 14: 10, 16: 10, 90: 10, 3: 10, 15: 10,
    5500: 50, 5501: 50, 6004: 10, 6005: 10, 6010: 10, 6003: 10, 6011: 10, 6009: 10, 
    6059: 10, 6068: 10, 6001: 10, 6066: 10, 6006: 10, 6002: 10, 6000: 10, 6034: 10,
    6113: 20, 6114: 20, 6115: 20
};

const TRADING_ADDRESS = '0x5B1A58e44f3fD24387A5fD7990A00422d2cB1aE4' as const;
const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0' as const;

const TRADING_ABI = [
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }, { internalType: "bytes", name: "oracleProof", type: "bytes" }], name: "openMarketPosition", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "bool", name: "isLimit", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "targetPrice", type: "uint48" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }], name: "placeOrder", outputs: [], stateMutability: "nonpayable", type: "function" }
] as const;

const VAULT_ABI = [
    { inputs: [{ internalType: "address", name: "trader", type: "address" }], name: "getTraderTotalBalance", outputs: [{ internalType: "uint256", name: "total6", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ internalType: "address", name: "", type: "address" }], name: "freeBalance", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }
] as const;

type OrderType = "limit" | "market" | "stop";

const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch proof`);
    return (await response.json()).proof as Hash;
};

// --- COMPOSANT INPUT CLEAN ---
interface CleanInputProps {
    value: string | number;
    onChange: (value: string) => void;
    label?: string;
    suffix?: string;
}

const CleanInput: React.FC<CleanInputProps> = ({ value, onChange, label, suffix }) => (
    <div className="flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors h-10 px-3">
        {label && <span className="text-xs text-slate-500 dark:text-zinc-500 pointer-events-none whitespace-nowrap">{label}</span>}
        <Input 
            type="number" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="flex-1 bg-transparent border-none text-right text-slate-900 dark:text-white text-sm font-mono focus-visible:ring-0 px-2 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
        />
        {suffix && <span className="text-xs text-slate-500 dark:text-zinc-500">{suffix}</span>}
    </div>
);

interface OrderPanelMobileProps {
    selectedAsset: Asset;
    currentPrice: number;
    paymasterEnabled?: boolean; 
    onTogglePaymaster?: () => void; 
    isChartOpen?: boolean;
    onToggleChart?: () => void;
    chartComponent?: React.ReactNode;
    onGoToWallet?: () => void;
}

export const OrderPanelMobile = ({
    selectedAsset, currentPrice, paymasterEnabled = false, onTogglePaymaster, isChartOpen = false, onToggleChart, chartComponent, onGoToWallet
}: OrderPanelMobileProps) => {

    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [leverage, setLeverage] = useState<number | string>(10);
    const [assetAmount, setAssetAmount] = useState<number | string>(1);
    const [limitPrice, setLimitPrice] = useState('');
    
    // NOUVEAU: Tracker si l'utilisateur a modifié le prix manuellement
    const [isUserEditedPrice, setIsUserEditedPrice] = useState(false);

    // States TP / SL
    const [tpEnabled, setTpEnabled] = useState(false);
    const [tpMode, setTpMode] = useState<"price" | "percent" | "pnl">("price");
    const [tpValue, setTpValue] = useState('');

    const [slEnabled, setSlEnabled] = useState(false);
    const [slMode, setSlMode] = useState<"price" | "percent" | "pnl">("price");
    const [slValue, setSlValue] = useState('');

    const [localLoading, setLocalLoading] = useState(false);

    const { refetchAll: refetchVault } = useVault();
    const { getConfigById } = useAssetConfig();
    const { address, chain: currentChain } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { executeOpenMarket, executePlaceOrder, isLoading: paymasterLoading } = usePaymaster();
    const { toast } = useToast();
    const publicClient = usePublicClient({ chainId: currentChain?.id });

    const safeAddress = address || '0x0000000000000000000000000000000000000000';

    const { data: balanceData, refetch: refetchBalances } = useReadContracts({
        contracts: [
            { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getTraderTotalBalance', args: [safeAddress] },
            { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'freeBalance', args: [safeAddress] }
        ],
        query: { enabled: !!address, refetchInterval: 5000 }
    });

    const totalBalanceVal = balanceData?.[0]?.status === 'success' ? Number(formatUnits(balanceData[0].result as bigint, 6)) : 0;
    const availableBalanceVal = balanceData?.[1]?.status === 'success' ? Number(formatUnits(balanceData[1].result as bigint, 6)) : 0;

    const finalAssetIdForTx = useMemo(() => {
        const id = Number(selectedAsset.id);
        return (isNaN(id) || id < 0) ? 0 : id;
    }, [selectedAsset.id]);

    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    const maxLeverageForAsset = useMemo(() => ASSET_MAX_LEVERAGE[finalAssetIdForTx] || 100, [finalAssetIdForTx]);
    const validLeveragesForAsset = useMemo(() => ALLOWED_LEVERAGES.filter(lev => lev <= maxLeverageForAsset), [maxLeverageForAsset]);

    const handleLeverageBlur = () => {
        const val = Number(leverage);
        if (isNaN(val)) return setLeverage(10);
        const closest = validLeveragesForAsset.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
        setLeverage(closest);
    };

    const lotSizeInAsset = ASSET_LOT_SIZES[finalAssetIdForTx] || 1;
    const actualLots = useMemo(() => Math.max(1, Math.round(Number(assetAmount) / lotSizeInAsset)), [assetAmount, lotSizeInAsset]);
    const effectiveAmount = actualLots * lotSizeInAsset;

    // Réinitialiser le tracker de modification manuelle si on change d'actif ou de type d'ordre
    useEffect(() => {
        setIsUserEditedPrice(false);
        setAssetAmount(lotSizeInAsset);
    }, [finalAssetIdForTx, lotSizeInAsset, orderType]);

    useEffect(() => { if (!isMarketOpen && orderType === "market") setOrderType("limit"); }, [isMarketOpen, orderType]);

    const assetConfig = getConfigById(finalAssetIdForTx);
    const { priceDecimals } = useMemo(() => {
        const decimals = Math.max(0, Math.round(Math.log10(1000000 / (assetConfig?.tick_size_usd6 || 10000))));
        return { priceDecimals: decimals };
    }, [assetConfig]);

    // Mettre à jour via WSS *uniquement* si l'utilisateur n'y a pas touché
    useEffect(() => {
        if (currentPrice > 0 && (orderType === 'limit' || orderType === 'stop')) {
            if (!isUserEditedPrice) {
                setLimitPrice(currentPrice.toFixed(priceDecimals));
            }
        }
    }, [currentPrice, priceDecimals, orderType, isUserEditedPrice]);

    // NOUVEAU: Handler personnalisé pour le Limit Price (Bloque le WSS)
    const handleLimitPriceChange = (newVal: string) => {
        setIsUserEditedPrice(true);
        setLimitPrice(newVal);
    };

    const calculations = useMemo(() => {
        const price = (orderType === 'limit' || orderType === 'stop') && limitPrice ? Number(limitPrice) : currentPrice;
        if (isNaN(price) || price <= 0 || effectiveAmount <= 0) return { value: 0, cost: 0, commission: 0 };
        const displayNotional = effectiveAmount * price; 
        const commissionRate = 0.001; 
        return { value: displayNotional, cost: displayNotional / Number(leverage), commission: displayNotional * commissionRate };
    }, [effectiveAmount, leverage, limitPrice, currentPrice, orderType]);

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isLoading = localLoading || paymasterLoading;

    // --- TRADE HANDLER & CALCUL TP/SL ---
    const handleTrade = async (tradeSide: 'long' | 'short') => {
        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        if (effectiveAmount <= 0) return toast({ title: 'Invalid amount', variant: "destructive" });

        const requiredMargin = calculations.cost * 1.01;
        if (availableBalanceVal < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        if (!paymasterEnabled) setLocalLoading(true);
        let txHash: Hash | string | undefined;

        try {
            const isLong = tradeSide === 'long';
            const levNum = Number(leverage);
            const entryPrice = (orderType === 'limit' || orderType === 'stop') ? Number(limitPrice) : currentPrice;

            let finalTpX6 = 0;
            if (tpEnabled && tpValue) {
                const val = Number(tpValue);
                let tpPriceCalc = 0;
                if (tpMode === 'price') {
                    tpPriceCalc = val;
                } else if (tpMode === 'pnl') {
                    tpPriceCalc = isLong ? entryPrice + (val / effectiveAmount) : entryPrice - (val / effectiveAmount);
                } else if (tpMode === 'percent') {
                    const roe = val / 100;
                    tpPriceCalc = isLong ? entryPrice * (1 + roe / levNum) : entryPrice * (1 - roe / levNum);
                }
                finalTpX6 = Math.round(Math.max(0, tpPriceCalc) * 1000000);
            }

            let finalSlX6 = 0;
            if (slEnabled && slValue) {
                const val = Math.abs(Number(slValue)); 
                let slPriceCalc = 0;
                if (slMode === 'price') {
                    slPriceCalc = Number(slValue);
                } else if (slMode === 'pnl') {
                    slPriceCalc = isLong ? entryPrice - (val / effectiveAmount) : entryPrice + (val / effectiveAmount);
                } else if (slMode === 'percent') {
                    const roe = val / 100;
                    slPriceCalc = isLong ? entryPrice * (1 - roe / levNum) : entryPrice * (1 + roe / levNum);
                }
                finalSlX6 = Math.round(Math.max(0, slPriceCalc) * 1000000);
            }

            if (paymasterEnabled) {
                if (orderType === 'limit' || orderType === 'stop') {
                    const targetPriceX6 = Math.round(entryPrice * 1000000);
                    txHash = await executePlaceOrder({
                        assetId: finalAssetIdForTx, isLong, isLimit: orderType === 'limit', leverage: levNum, lotSize: actualLots, targetPrice: targetPriceX6, stopLoss: finalSlX6, takeProfit: finalTpX6
                    });
                } else {
                    txHash = await executeOpenMarket({
                        assetId: finalAssetIdForTx, isLong, leverage: levNum, lotSize: actualLots, stopLoss: finalSlX6, takeProfit: finalTpX6
                    });
                }
            } else {
                if (orderType === 'limit' || orderType === 'stop') {
                    const targetPriceX6 = Math.round(entryPrice * 1000000);
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, abi: TRADING_ABI, functionName: 'placeOrder',
                        args: [finalAssetIdForTx, isLong, orderType === 'limit', levNum, actualLots, BigInt(targetPriceX6), BigInt(finalSlX6), BigInt(finalTpX6)],
                    });
                } else {
                    const proof = await getMarketProof(finalAssetIdForTx);
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, abi: TRADING_ABI, functionName: 'openMarketPosition',
                        args: [finalAssetIdForTx, isLong, levNum, actualLots, BigInt(finalSlX6), BigInt(finalTpX6), proof],
                    });
                }
                if (publicClient && txHash) await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
            }

            toast({ title: 'Order Placed', description: `${isLong ? 'Buy' : 'Sell'} order successful.` });
            refetchVault();
            refetchBalances();
        } catch (e: any) {
            console.error(e);
            toast({ title: 'Order failed', description: e.message || "An error occurred", variant: "destructive" });
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-black text-slate-900 dark:text-white font-sans overflow-hidden transition-colors">
            
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-900 bg-white dark:bg-black flex-shrink-0 transition-colors">
                <span className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Trading Setup</span>
                <div className="flex items-center gap-2">
                    {onTogglePaymaster && (
                        <button 
                            className={`px-3 py-1.5 flex items-center gap-1.5 rounded-[4px] text-[11px] font-bold border transition-colors ${
                                paymasterEnabled 
                                ? "bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white" 
                                : "bg-transparent text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-500"
                            }`} 
                            onClick={onTogglePaymaster}
                        >
                            <Fuel className="w-3 h-3" /> Paymaster
                        </button>
                    )}
                    {onToggleChart && (
                        <button 
                            onClick={onToggleChart} 
                            className={`px-3 py-1.5 flex items-center gap-1.5 rounded-[4px] text-[11px] font-bold border transition-colors ${
                                isChartOpen 
                                ? "bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white" 
                                : "bg-transparent text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-500"
                            }`}
                        >
                            <CandlestickChart className="w-3 h-3" /> Chart
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENU SCROLLABLE */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                {/* INJECTION DU GRAPHIQUE ICI (Il va scroller avec le reste) */}
                {chartComponent}

                <MarketClosedBanner status={marketStatus} />

                <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                        <select 
                            value={orderType}
                            onChange={(e) => { if (e.target.value === 'market' && !isMarketOpen) return; setOrderType(e.target.value as OrderType); }}
                            className="w-full appearance-none bg-slate-50 dark:bg-[#111] text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-800 rounded-[4px] py-2 px-3 text-sm font-semibold outline-none focus:border-blue-600 cursor-pointer transition-colors"
                        >
                            <option value="limit">Limit Order</option>
                            <option value="market" disabled={!isMarketOpen}>Market Order</option>
                            <option value="stop">Stop Order</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-[10px] w-4 h-4 text-slate-500 dark:text-zinc-500 pointer-events-none" />
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] px-3 focus-within:border-blue-600 transition-colors">
                        <span className="text-xs text-slate-500 dark:text-zinc-500 font-semibold pointer-events-none">Levier</span>
                        <div className="flex items-center w-[50px]">
                            <Input type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} onBlur={handleLeverageBlur} className="w-full h-9 bg-transparent border-none text-right text-slate-900 dark:text-white font-mono focus-visible:ring-0 p-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="text-slate-500 dark:text-zinc-500 text-sm ml-1">x</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {(orderType === "limit" || orderType === "stop") && (
                        <CleanInput label="Price" suffix="USDT" value={limitPrice} onChange={handleLimitPriceChange} />
                    )}
                    <CleanInput label="Size" suffix={selectedAsset.symbol.split('/')[0]} value={assetAmount} onChange={setAssetAmount} />
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-500 dark:text-zinc-500">Avbl</span>
                    <span className="font-mono text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300" onClick={onGoToWallet}>
                        {formatUSD(availableBalanceVal)} USDT 
                        <span className="text-blue-600 dark:text-blue-500 text-[10px] font-bold uppercase tracking-wider ml-1 bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-[2px]">Deposit</span>
                    </span>
                </div>

                <div className="space-y-4 border-t border-slate-200 dark:border-zinc-900 pt-4">
                    
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Checkbox id="tp" checked={tpEnabled} onCheckedChange={(c) => setTpEnabled(!!c)} className="h-4 w-4 border-slate-300 dark:border-zinc-600 bg-transparent rounded-[2px] data-[state=checked]:bg-slate-900 dark:data-[state=checked]:bg-white data-[state=checked]:border-slate-900 dark:data-[state=checked]:border-white data-[state=checked]:text-white dark:data-[state=checked]:text-black" />
                            <label htmlFor="tp" className="text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">Take Profit</label>
                        </div>
                        {tpEnabled && (
                            <div className="flex gap-2">
                                <div className="relative w-24">
                                    <select 
                                        value={tpMode} onChange={(e) => setTpMode(e.target.value as any)}
                                        className="w-full appearance-none bg-slate-50 dark:bg-[#111] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-[4px] h-8 px-2 pr-6 text-[11px] font-semibold outline-none focus:border-blue-500 cursor-pointer transition-colors"
                                    >
                                        <option value="price">Price</option>
                                        <option value="percent">ROE %</option>
                                        <option value="pnl">PnL $</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-slate-500 dark:text-zinc-500 pointer-events-none" />
                                </div>
                                <div className="flex-1 flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 h-8 px-2 transition-colors">
                                    <Input type="number" placeholder="0.00" value={tpValue} onChange={(e) => setTpValue(e.target.value)} className="flex-1 bg-transparent border-none text-right text-slate-900 dark:text-white text-xs font-mono focus-visible:ring-0 p-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-slate-500 dark:text-zinc-500 text-[10px] ml-1.5">{tpMode === 'price' ? 'USDT' : tpMode === 'percent' ? '%' : 'USDT'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Checkbox id="sl" checked={slEnabled} onCheckedChange={(c) => setSlEnabled(!!c)} className="h-4 w-4 border-slate-300 dark:border-zinc-600 bg-transparent rounded-[2px] data-[state=checked]:bg-slate-900 dark:data-[state=checked]:bg-white data-[state=checked]:border-slate-900 dark:data-[state=checked]:border-white data-[state=checked]:text-white dark:data-[state=checked]:text-black" />
                            <label htmlFor="sl" className="text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">Stop Loss</label>
                        </div>
                        {slEnabled && (
                            <div className="flex gap-2">
                                <div className="relative w-24">
                                    <select 
                                        value={slMode} onChange={(e) => setSlMode(e.target.value as any)}
                                        className="w-full appearance-none bg-slate-50 dark:bg-[#111] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-[4px] h-8 px-2 pr-6 text-[11px] font-semibold outline-none focus:border-blue-500 cursor-pointer transition-colors"
                                    >
                                        <option value="price">Price</option>
                                        <option value="percent">ROE %</option>
                                        <option value="pnl">PnL $</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-slate-500 dark:text-zinc-500 pointer-events-none" />
                                </div>
                                <div className="flex-1 flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 h-8 px-2 transition-colors">
                                    <Input type="number" placeholder="0.00" value={slValue} onChange={(e) => setSlValue(e.target.value)} className="flex-1 bg-transparent border-none text-right text-slate-900 dark:text-white text-xs font-mono focus-visible:ring-0 p-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-slate-500 dark:text-zinc-500 text-[10px] ml-1.5">{slMode === 'price' ? 'USDT' : slMode === 'percent' ? '%' : 'USDT'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2 text-xs pt-2">
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-500">Notional</span><span className="font-mono text-slate-700 dark:text-zinc-300">{formatUSD(calculations.value)} USDT</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-500">Margin</span><span className="font-mono text-slate-900 dark:text-white">{formatUSD(calculations.cost)} USDT</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-500">Est. Fee</span><span className="font-mono text-slate-700 dark:text-zinc-300">{formatUSD(calculations.commission)} USDT</span></div>
                </div>
            </div>

            <div className="p-4 bg-white dark:bg-black border-t border-slate-200 dark:border-zinc-900 flex gap-3 flex-shrink-0 transition-colors">
                {availableBalanceVal <= 0 ? (
                    <Button onClick={onGoToWallet} className="w-full h-12 text-sm font-bold shadow-none rounded-[4px] bg-[#DEAA79] hover:bg-[#c99a6c] text-black transition-transform active:scale-[0.98] flex items-center justify-center gap-2">
                        <Wallet className="w-4 h-4" /> Deposit
                    </Button>
                ) : (
                    <>
                        <Button onClick={() => handleTrade('long')} disabled={isLoading} className="flex-1 h-12 text-sm font-bold shadow-none rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white transition-transform active:scale-[0.98]">
                            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Buy / Long'}
                        </Button>
                        <Button onClick={() => handleTrade('short')} disabled={isLoading} className="flex-1 h-12 text-sm font-bold shadow-none rounded-[4px] bg-red-600 hover:bg-red-700 text-white transition-transform active:scale-[0.98]">
                            {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Sell / Short'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};
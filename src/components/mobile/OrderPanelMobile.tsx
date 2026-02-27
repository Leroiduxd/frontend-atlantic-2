"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault"; 
import { useToast } from "@/hooks/use-toast";
import { Asset } from "../ChartControls"; 
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { useWriteContract, useAccount, usePublicClient, useReadContracts } from 'wagmi';
import { usePaymaster } from "@/hooks/useBrokexPaymaster"; 
import { ChevronUp, ChevronDown, X, Loader2, Fuel } from 'lucide-react'; 
import { Hash, formatUnits } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { MarketClosedBanner } from "../MarketClosedBanner";

// --- MAPPING DES TAILLES DE LOTS ---
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01,    // btc_usdt
    1: 0.01,     // eth_usdt
    2: 1,       // link_usdt
    3: 1000,    // doge_usdt
    5: 1,       // avax_usdt
    10: 1,      // sol_usdt
    14: 100,    // xrp_usdt
    15: 1000,   // trx_usdt
    16: 100,    // ada_usdt
    90: 10,     // sui_usdt
    5500: 0.01, // xau_usd
    5501: 0.1,  // xag_usd
};

// --- LEVIERS AUTORISÉS (Global) ---
const ALLOWED_LEVERAGES = [1, 2, 3, 5, 10, 20, 25, 50, 100];

// --- MAPPING DES LEVIERS MAX ---
const ASSET_MAX_LEVERAGE: Record<number, number> = {
    0: 20, 1: 20, 
    10: 10, 5: 10, 2: 10, 14: 10, 16: 10, 90: 10, 3: 10, 15: 10,
    5500: 50, 5501: 50,
    6004: 10, 6005: 10, 6010: 10, 6003: 10, 6011: 10, 6009: 10, 
    6059: 10, 6068: 10, 6001: 10, 6066: 10, 6006: 10, 6002: 10, 
    6000: 10, 6034: 10,
    6113: 20, 6114: 20, 6115: 20
};

// --- CONSTANTES ---
const TRADING_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B' as const;
const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0' as const;

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
        <div className="flex flex-col gap-0.5 w-full">
            {label && <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wide">{label}</span>}
            <div className="relative flex items-center h-9">
                <Button 
                    variant="outline" 
                    className="h-full w-10 px-0 rounded-l-md rounded-r-none border-r-0 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    onClick={() => handleStep(-step)}
                >
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                </Button>
                
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-full text-center rounded-none border-x-0 bg-white dark:bg-black dark:border-zinc-800 text-sm font-mono focus-visible:ring-0 px-1 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                
                <Button 
                    variant="outline" 
                    className="h-full w-10 px-0 rounded-r-md rounded-l-none border-l-0 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    onClick={() => handleStep(step)}
                >
                    <ChevronUp className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
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
    side: "long" | "short"; 
    paymasterEnabled?: boolean; 
    onTogglePaymaster?: () => void; 
}

// --- MAIN COMPONENT ---
export const OrderPanelMobile = ({
    selectedAsset,
    currentPrice,
    onClose,
    side,
    paymasterEnabled = false,
    onTogglePaymaster
}: OrderPanelMobileProps) => {

    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [leverage, setLeverage] = useState(10);
    const [assetAmount, setAssetAmount] = useState<number | string>(1);
    const [limitPrice, setLimitPrice] = useState('');
    const [tpPrice, setTpPrice] = useState('');
    const [slPrice, setSlPrice] = useState('');
    const [localLoading, setLocalLoading] = useState(false);

    const { refetchAll: refetchVault } = useVault();
    const { getConfigById } = useAssetConfig();
    const { address, chain: currentChain } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const { executeOpenMarket, executePlaceOrder, isLoading: paymasterLoading } = usePaymaster();
    const { toast } = useToast();
    const publicClient = usePublicClient({ chainId: currentChain?.id });

    // --- LECTURE BALANCES ---
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
        query: { enabled: !!address, refetchInterval: 5000 }
    });

    const totalBalanceVal = balanceData?.[0]?.result ? Number(formatUnits(balanceData[0].result, 6)) : 0;
    const availableBalanceVal = balanceData?.[1]?.result ? Number(formatUnits(balanceData[1].result, 6)) : 0;

    const finalAssetIdForTx = useMemo(() => {
        const id = Number(selectedAsset.id);
        return (isNaN(id) || id < 0) ? 0 : id;
    }, [selectedAsset.id]);

    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    // --- LOGIQUE LEVIER DYNAMIQUE RESTREINT ---
    const maxLeverageForAsset = useMemo(() => ASSET_MAX_LEVERAGE[finalAssetIdForTx] || 100, [finalAssetIdForTx]);
    
    const validLeveragesForAsset = useMemo(() => {
        return ALLOWED_LEVERAGES.filter(lev => lev <= maxLeverageForAsset);
    }, [maxLeverageForAsset]);

    const currentLeverageIndex = validLeveragesForAsset.indexOf(leverage);
    const safeLeverageIndex = currentLeverageIndex >= 0 ? currentLeverageIndex : validLeveragesForAsset.length - 1;

    useEffect(() => {
        if (!validLeveragesForAsset.includes(leverage)) {
            setLeverage(validLeveragesForAsset[validLeveragesForAsset.length - 1]);
        }
    }, [validLeveragesForAsset, leverage]);


    // --- LOGIQUE DES LOTS ---
    const lotSizeInAsset = ASSET_LOT_SIZES[finalAssetIdForTx] || 1;
    const amountDecimals = Math.max(0, -Math.floor(Math.log10(lotSizeInAsset)));
    
    const actualLots = useMemo(() => {
        return Math.max(1, Math.round(Number(assetAmount) / lotSizeInAsset));
    }, [assetAmount, lotSizeInAsset]);

    const effectiveAmount = actualLots * lotSizeInAsset;

    useEffect(() => {
        setAssetAmount(lotSizeInAsset);
    }, [finalAssetIdForTx, lotSizeInAsset]);

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
        if (isNaN(price) || price <= 0 || effectiveAmount <= 0) return { value: 0, cost: 0, commission: 0 };
        
        const displayNotional = effectiveAmount * price; 
        const commissionRate = 0.001; 

        return {
            value: displayNotional,
            cost: displayNotional / leverage,
            commission: displayNotional * commissionRate,
        };
    }, [effectiveAmount, leverage, limitPrice, currentPrice, orderType]);

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isLoading = localLoading || paymasterLoading;

    // --- TRADE HANDLER ---
    const handleTrade = async () => {
        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        
        const requiredMargin = calculations.cost * 1.01;
        if (availableBalanceVal < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        if (!paymasterEnabled) setLocalLoading(true);
        let txHash: Hash | string | undefined;

        try {
            const numLimitPrice = Number(limitPrice);
            const isLong = side === 'long';
            
            const slX6 = slEnabled && slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
            const tpX6 = tpEnabled && tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;

            if (paymasterEnabled) {
                if (orderType === 'limit' || orderType === 'stop') {
                    const targetPriceX6 = Math.round(numLimitPrice * 1000000);
                    txHash = await executePlaceOrder({
                        assetId: finalAssetIdForTx,
                        isLong,
                        isLimit: orderType === 'limit',
                        leverage,
                        lotSize: actualLots,
                        targetPrice: targetPriceX6,
                        stopLoss: slX6,
                        takeProfit: tpX6
                    });
                } else {
                    txHash = await executeOpenMarket({
                        assetId: finalAssetIdForTx,
                        isLong,
                        leverage,
                        lotSize: actualLots,
                        stopLoss: slX6,
                        takeProfit: tpX6
                    });
                }
            } else {
                if (orderType === 'limit' || orderType === 'stop') {
                    const targetPriceX6 = Math.round(numLimitPrice * 1000000);
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, 
                        abi: TRADING_ABI, 
                        functionName: 'placeOrder',
                        args: [
                            finalAssetIdForTx, isLong, orderType === 'limit', leverage, actualLots, 
                            BigInt(targetPriceX6), BigInt(slX6), BigInt(tpX6)
                        ],
                    });
                } else {
                    const proof = await getMarketProof(finalAssetIdForTx);
                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, 
                        abi: TRADING_ABI, 
                        functionName: 'openMarketPosition',
                        args: [
                            finalAssetIdForTx, isLong, leverage, actualLots, 
                            BigInt(slX6), BigInt(tpX6), proof
                        ],
                    });
                }
                if (publicClient && txHash) await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
            }

            toast({ title: 'Order Placed', description: `${isLong ? 'Buy' : 'Sell'} order successful.` });
            refetchVault();
            refetchBalances();
            if(onClose) onClose();

        } catch (e: any) {
            console.error(e);
            toast({ title: 'Order failed', description: e.message || "An error occurred", variant: "destructive" });
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-black text-slate-900 dark:text-white font-sans overflow-hidden">
            
            {/* HEADER DU SHEET */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                <div className="flex flex-col">
                    <span className={`text-base font-bold ${side === 'long' ? 'text-blue-600' : 'text-red-600'}`}>
                        {side === 'long' ? 'Buy Long' : 'Sell Short'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">
                        {selectedAsset.symbol} @ {Number(currentPrice).toFixed(priceDecimals)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {onTogglePaymaster && (
                        <Button 
                            variant="ghost" 
                            className={`h-7 px-2 flex items-center gap-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex-shrink-0 transition-colors ${
                                paymasterEnabled 
                                ? "bg-amber-400 hover:bg-amber-500 text-black" 
                                : "bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
                            }`} 
                            onClick={onTogglePaymaster}
                        >
                            <Fuel className="w-3 h-3" />
                            Paymaster
                        </Button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENU SCROLLABLE SANS SCROLLBAR VISIBLE */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                <MarketClosedBanner status={marketStatus} />

                {/* Balance Info */}
                <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Available</span>
                        <span className="text-xs font-mono font-bold">${formatUSD(availableBalanceVal)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Total</span>
                        <span className="text-xs font-mono font-bold">${formatUSD(totalBalanceVal)}</span>
                    </div>
                </div>

                {/* Order Type Tabs */}
                <div className="bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg flex">
                    {(['limit', 'market', 'stop'] as OrderType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => isMarketOpen && setOrderType(type)}
                            disabled={type === 'market' && !isMarketOpen}
                            className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-md transition-all duration-200
                                ${orderType === type 
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' 
                                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 disabled:opacity-50'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Leverage Slider (Valeurs restreintes) */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                        <span>Leverage</span>
                        <span className="text-slate-900 dark:text-white font-bold">{leverage}x</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max={validLeveragesForAsset.length - 1} 
                        step="1"
                        value={safeLeverageIndex} 
                        onChange={(e) => {
                            const newIndex = Number(e.target.value);
                            setLeverage(validLeveragesForAsset[newIndex]);
                        }}
                        className={`w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer 
                            ${side === 'long' ? 'accent-blue-600' : 'accent-red-600'}
                        `}
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                        <span>1x</span>
                        <span>{validLeveragesForAsset[Math.floor(validLeveragesForAsset.length / 2)]}x</span>
                        <span>{maxLeverageForAsset}x</span>
                    </div>
                </div>

                {/* Inputs (Lots & Price) */}
                <div className="space-y-3 pt-1">
                    {(orderType === "limit" || orderType === "stop") && (
                        <StepController 
                            label={`Price (USD)`}
                            value={limitPrice} onChange={setLimitPrice} 
                            step={priceStep} decimals={priceDecimals} 
                        />
                    )}

                    <StepController 
                        label={`Amount (${selectedAsset.symbol.split('/')[0]})`}
                        value={assetAmount} onChange={setAssetAmount} 
                        step={lotSizeInAsset} min={lotSizeInAsset} decimals={amountDecimals} 
                    />
                </div>

                {/* TP / SL */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <Checkbox id="tp" checked={tpEnabled} onCheckedChange={(c) => setTpEnabled(!!c)} className="h-3.5 w-3.5 dark:border-zinc-600" />
                            <label htmlFor="tp" className="text-[10px] font-bold uppercase text-slate-500">Take Profit</label>
                        </div>
                        {tpEnabled && (
                            <Input 
                                type="number" placeholder="0.00" 
                                value={tpPrice} onChange={(e) => setTpPrice(e.target.value)}
                                className="h-8 text-xs px-2 dark:bg-zinc-900 dark:border-zinc-800 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                            <Checkbox id="sl" checked={slEnabled} onCheckedChange={(c) => setSlEnabled(!!c)} className="h-3.5 w-3.5 dark:border-zinc-600" />
                            <label htmlFor="sl" className="text-[10px] font-bold uppercase text-slate-500">Stop Loss</label>
                        </div>
                        {slEnabled && (
                            <Input 
                                type="number" placeholder="0.00" 
                                value={slPrice} onChange={(e) => setSlPrice(e.target.value)}
                                className="h-8 text-xs px-2 dark:bg-zinc-900 dark:border-zinc-800 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        )}
                    </div>
                </div>

                {/* Summary Box */}
                <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-3 space-y-1.5 text-[11px] border border-slate-100 dark:border-zinc-800">
                    <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-zinc-500">Notional</span>
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

            {/* Action Button */}
            <div className="p-3 pb-6 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-black flex-shrink-0">
                <Button 
                    onClick={() => handleTrade()} 
                    disabled={isLoading}
                    className={`w-full h-10 text-sm font-bold text-white shadow-md transition-transform active:scale-[0.98]
                        ${side === 'long' 
                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                            : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                        }
                    `}
                >
                    {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : (side === 'long' ? 'Confirm Buy' : 'Confirm Sell')}
                </Button>
            </div>
        </div>
    );
};
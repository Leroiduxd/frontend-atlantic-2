"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault"; 
import { useToast } from "@/hooks/use-toast";
import { DepositDialog } from "@/components/DepositDialog";
import { Asset } from "./ChartControls";
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { MarketClosedBanner } from "./MarketClosedBanner";
import { useWriteContract, useAccount, usePublicClient, useReadContracts } from 'wagmi';
import { usePaymaster } from "@/hooks/useBrokexPaymaster"; 
import { Landmark, ChevronUp, ChevronDown, Fuel, Eye, EyeOff } from 'lucide-react'; 
import { Hash, formatUnits } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { FaucetDialog } from "@/components/FaucetDialog";

// --- MAPPING DES TAILLES DE LOTS ---
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

// --- CONSTANTES TRADING ---
const TRADING_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B' as const;
const TRADING_ABI = [
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }, { internalType: "bytes", name: "oracleProof", type: "bytes" }], name: "openMarketPosition", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ internalType: "uint32", name: "assetId", type: "uint32" }, { internalType: "bool", name: "isLong", type: "bool" }, { internalType: "bool", name: "isLimit", type: "bool" }, { internalType: "uint8", name: "leverage", type: "uint8" }, { internalType: "int32", name: "lotSize", type: "int32" }, { internalType: "uint48", name: "targetPrice", type: "uint48" }, { internalType: "uint48", name: "stopLoss", type: "uint48" }, { internalType: "uint48", name: "takeProfit", type: "uint48" }], name: "placeOrder", outputs: [], stateMutability: "nonpayable", type: "function" }
] as const;

// --- CONSTANTES VAULT ---
const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0' as const;
const VAULT_ABI = [
    { inputs: [{ internalType: "address", name: "trader", type: "address" }], name: "getTraderTotalBalance", outputs: [{ internalType: "uint256", name: "total6", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ internalType: "address", name: "", type: "address" }], name: "freeBalance", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }
] as const;

// --- CUSTOM DROPDOWN (Évite le select natif du navigateur) ---
const CustomDropdown = ({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: {label: string, value: string}[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || "";

    return (
        <div className="relative w-24" ref={dropdownRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-[#111] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-[4px] h-8 px-2 text-[11px] font-semibold cursor-pointer hover:border-blue-500 transition-colors"
            >
                <span className="select-none">{selectedLabel}</span>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] z-50 shadow-lg overflow-hidden">
                    {options.map((option) => (
                        <div 
                            key={option.value}
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            className={`px-2 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${value === option.value ? 'bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'}`}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface StepControllerProps {
    value: string | number;
    onChange: (value: any) => void;
    step: number;
    min?: number;
    max?: number;
    decimals?: number;
    isCompact?: boolean;
}

const StepController: React.FC<StepControllerProps> = ({
    value, onChange, step, min = 0, max = Infinity, decimals = 2, isCompact = false
}) => {
    const numericValue = Number(value);
    const handleStep = (delta: number) => {
        const newValue = Math.min(max, Math.max(min, numericValue + delta));
        const finalDecimals = isCompact && step === 1 ? 0 : decimals;
        onChange(Number(newValue.toFixed(finalDecimals)));
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const widthClass = isCompact 
        ? 'w-full text-center h-7 text-xs p-1 pr-5 dark:bg-black dark:border-zinc-800 dark:text-white dark:focus:border-zinc-600' 
        : 'w-full text-lg font-medium pr-10 dark:bg-black dark:border-zinc-800 dark:text-white dark:focus:border-zinc-600';
    const buttonWidth = isCompact ? 'w-5' : 'w-8';
    const iconSize = isCompact ? 'w-3 h-3' : 'w-4 h-4';

    return (
        <div className="relative flex items-center">
            <Input type="text" placeholder="0.00" value={value} onChange={handleInputChange} className={widthClass} />
            <div className={`absolute right-0 top-0 h-full flex flex-col justify-center border-l border-border dark:border-zinc-800`}>
                <Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 border-b border-border/80 dark:border-zinc-800 rounded-none rounded-tr-sm hover:dark:bg-zinc-900`} onClick={() => handleStep(step)}>
                    <ChevronUp className={`${iconSize} dark:text-zinc-500`} />
                </Button>
                <Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 rounded-none rounded-br-sm hover:dark:bg-zinc-900`} onClick={() => handleStep(-step)}>
                    <ChevronDown className={`${iconSize} dark:text-zinc-500`} />
                </Button>
            </div>
        </div>
    );
};

type OrderType = "limit" | "market" | "stop";

const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch proof`);
    const data = await response.json();
    return data.proof as Hash;
};

interface OrderPanelProps {
    selectedAsset: Asset;
    currentPrice: number;
    paymasterEnabled: boolean;
    onTogglePaymaster: () => void;
    onGoToWallet?: () => void;
}

const OrderPanel = ({
    selectedAsset, currentPrice, paymasterEnabled, onTogglePaymaster, onGoToWallet
}: OrderPanelProps) => {

    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [leverage, setLeverage] = useState(10);
    const [assetAmount, setAssetAmount] = useState<number | string>(1); 
    const [limitPrice, setLimitPrice] = useState('');
    const [isUserEditedPrice, setIsUserEditedPrice] = useState(false);
    const [isFaucetOpen, setIsFaucetOpen] = useState(false);

    // NOUVEAUX ETATS TP/SL EXACTEMENT COMME SUR MOBILE
    const [tpEnabled, setTpEnabled] = useState(false);
    const [tpMode, setTpMode] = useState<"price" | "percent" | "pnl">("price");
    const [tpValue, setTpValue] = useState('');

    const [slEnabled, setSlEnabled] = useState(false);
    const [slMode, setSlMode] = useState<"price" | "percent" | "pnl">("price");
    const [slValue, setSlValue] = useState('');

    const [localLoading, setLocalLoading] = useState(false);
    const [showBalance, setShowBalance] = useState(true); 

    const { refetchAll: refetchVault } = useVault();
    const { getConfigById } = useAssetConfig();
    const { address, chain: currentChain } = useAccount();
    const { executeOpenMarket, executePlaceOrder, isLoading: paymasterLoading } = usePaymaster();
    const { writeContractAsync } = useWriteContract();
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

    const totalBalanceVal = balanceData?.[0]?.result ? Number(formatUnits(balanceData[0].result, 6)) : 0;
    const availableBalanceVal = balanceData?.[1]?.result ? Number(formatUnits(balanceData[1].result, 6)) : 0;
    const lockedBalanceVal = totalBalanceVal - availableBalanceVal;

    const loading = localLoading || paymasterLoading;
    
    const finalAssetIdForTx = useMemo(() => {
        const id = Number(selectedAsset.id);
        return (isNaN(id) || id < 0) ? 0 : id;
    }, [selectedAsset.id]);

    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    const lotSizeInAsset = ASSET_LOT_SIZES[finalAssetIdForTx] || 1;
    const amountDecimals = Math.max(0, -Math.floor(Math.log10(lotSizeInAsset)));
    
    const actualLots = useMemo(() => Math.max(1, Math.round(Number(assetAmount) / lotSizeInAsset)), [assetAmount, lotSizeInAsset]);
    const effectiveAmount = actualLots * lotSizeInAsset;

    useEffect(() => { setAssetAmount(lotSizeInAsset); }, [finalAssetIdForTx, lotSizeInAsset]);
    useEffect(() => { if (!isMarketOpen && orderType === "market") setOrderType("limit"); }, [isMarketOpen, orderType]);

    const assetConfig = getConfigById(finalAssetIdForTx);
    const { priceDecimals, priceStep } = useMemo(() => {
        const decimals = Math.max(0, Math.round(Math.log10(1000000 / (assetConfig?.tick_size_usd6 || 10000))));
        return { priceDecimals: decimals, priceStep: 1 / (10 ** decimals) };
    }, [assetConfig]);

    useEffect(() => { setIsUserEditedPrice(false); }, [selectedAsset.id, orderType]);

    useEffect(() => {
        if (currentPrice > 0 && (orderType === 'limit' || orderType === 'stop')) {
            if (!isUserEditedPrice) {
                setLimitPrice(currentPrice.toFixed(priceDecimals));
            }
        }
    }, [currentPrice, priceDecimals, orderType, isUserEditedPrice]);

    const handleLimitPriceChange = (newVal: any) => {
        setIsUserEditedPrice(true);
        setLimitPrice(newVal);
    };

    const calculations = useMemo(() => {
        const price = (orderType === 'limit' || orderType === 'stop') && limitPrice ? Number(limitPrice) : currentPrice;
        if (isNaN(price) || price <= 0 || effectiveAmount <= 0) return { value: 0, cost: 0, commission: 0, liqPriceLong: 0, liqPriceShort: 0 };
        
        const displayNotional = effectiveAmount * price; 
        const commissionRate = 0.001; 

        return {
            value: displayNotional,
            cost: displayNotional / leverage,
            commission: displayNotional * commissionRate,
            liqPriceLong: price * (1 - 0.99 / leverage),
            liqPriceShort: price * (1 + 0.99 / leverage),
        };
    }, [effectiveAmount, leverage, limitPrice, currentPrice, orderType]);

    const formatPrice = (value: number) => value === 0 ? "0.00" : value.toFixed(priceDecimals > 5 ? 5 : priceDecimals || 2);
    const getDisplayValue = useCallback((value: string | number) => showBalance ? value : '***', [showBalance]);

    // --- LOGIQUE METIER TP / SL IDENTIQUE A MOBILE ---
    const handleTrade = async (longSide: boolean) => {
        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        if (effectiveAmount <= 0) return toast({ title: 'Invalid amount', variant: "destructive" });

        const requiredMargin = calculations.cost * 1.01;
        if (availableBalanceVal < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        if (!paymasterEnabled) setLocalLoading(true);
        let txHash: Hash | string | undefined;

        try {
            const isLong = longSide;
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
            console.error("Order error:", e);
            toast({ title: 'Order failed', description: e.message || "An error occurred", variant: "destructive" });
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <div className="w-[320px] h-full flex flex-col border-l border-border dark:border-zinc-800 shadow-md bg-card dark:bg-black transition-colors duration-300">
            <MarketClosedBanner status={marketStatus} />

            <div className="flex-grow p-4 space-y-5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                <div className="flex justify-between items-center border-b border-border dark:border-zinc-800 text-muted-foreground font-medium text-sm pt-1 pb-2">
                    <div className="flex">
                        <div className={`py-1 mr-4 cursor-pointer transition ${orderType === "limit" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white" : "hover:text-foreground dark:hover:text-zinc-400"}`} onClick={() => setOrderType("limit")}>Limit</div>
                        <div className={`py-1 mr-4 cursor-pointer transition ${orderType === "stop" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white" : "hover:text-foreground dark:hover:text-zinc-400"}`} onClick={() => setOrderType("stop")}>Stop</div>
                        <div className={`py-1 mr-4 transition ${!isMarketOpen ? "opacity-50 cursor-not-allowed" : orderType === "market" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white cursor-pointer" : "hover:text-foreground dark:hover:text-zinc-400 cursor-pointer"}`} onClick={() => isMarketOpen && setOrderType("market")}>Market</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-20">
                            <StepController value={leverage} onChange={setLeverage} step={1} min={1} max={100} decimals={0} isCompact={true} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className={`h-7 w-7 rounded-md ${paymasterEnabled ? "bg-amber-400 text-white" : "border border-border dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"}`} onClick={onTogglePaymaster}>
                            <Fuel className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {(orderType === "limit" || orderType === "stop") && (
                    <div>
                        <span className="text-light-text dark:text-zinc-500 text-xs block mb-1">
                            {orderType === "stop" ? "Stop Price (USD)" : "Limit Price (USD)"}
                        </span>
                        <StepController value={limitPrice} onChange={handleLimitPriceChange} step={priceStep} decimals={priceDecimals} />
                    </div>
                )}

                <div>
                    <span className="text-light-text dark:text-zinc-500 text-xs block mb-1">
                        Amount ({selectedAsset.symbol.split('/')[0]})
                    </span>
                    <StepController value={assetAmount} onChange={setAssetAmount} step={lotSizeInAsset} min={lotSizeInAsset} decimals={amountDecimals} />
                </div>

                {/* --- SECTIONS TAKE PROFIT & STOP LOSS --- */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center text-foreground dark:text-zinc-300 cursor-pointer w-max">
                            <Checkbox 
                                checked={tpEnabled} 
                                onCheckedChange={(c) => setTpEnabled(!!c)} 
                                className="mr-2 dark:border-zinc-600 dark:data-[state=checked]:bg-zinc-200 dark:data-[state=checked]:text-black" 
                            />
                            <span className="text-sm">Take Profit</span>
                        </label>
                        {tpEnabled && (
                            <div className="flex gap-2">
                                <CustomDropdown 
                                    value={tpMode} 
                                    onChange={(v) => setTpMode(v as any)} 
                                    options={[
                                        { label: "Price", value: "price" },
                                        { label: "ROE %", value: "percent" },
                                        { label: "PnL $", value: "pnl" }
                                    ]}
                                />
                                <div className="flex-1 flex items-center bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 h-8 px-2 transition-colors">
                                    <Input 
                                        type="number" placeholder="0.00" value={tpValue} onChange={(e) => setTpValue(e.target.value)} 
                                        className="flex-1 bg-transparent border-none text-right text-slate-900 dark:text-white text-xs font-mono focus-visible:ring-0 p-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    />
                                    <span className="text-slate-500 dark:text-zinc-500 text-[10px] ml-1.5">{tpMode === 'price' ? 'USDT' : tpMode === 'percent' ? '%' : 'USDT'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="flex items-center text-foreground dark:text-zinc-300 cursor-pointer w-max">
                            <Checkbox 
                                checked={slEnabled} 
                                onCheckedChange={(c) => setSlEnabled(!!c)} 
                                className="mr-2 dark:border-zinc-600 dark:data-[state=checked]:bg-zinc-200 dark:data-[state=checked]:text-black" 
                            />
                            <span className="text-sm">Stop Loss</span>
                        </label>
                        {slEnabled && (
                            <div className="flex gap-2">
                                <CustomDropdown 
                                    value={slMode} 
                                    onChange={(v) => setSlMode(v as any)} 
                                    options={[
                                        { label: "Price", value: "price" },
                                        { label: "ROE %", value: "percent" },
                                        { label: "PnL $", value: "pnl" }
                                    ]}
                                />
                                <div className="flex-1 flex items-center bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 h-8 px-2 transition-colors">
                                    <Input 
                                        type="number" placeholder="0.00" value={slValue} onChange={(e) => setSlValue(e.target.value)} 
                                        className="flex-1 bg-transparent border-none text-right text-slate-900 dark:text-white text-xs font-mono focus-visible:ring-0 p-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    />
                                    <span className="text-slate-500 dark:text-zinc-500 text-[10px] ml-1.5">{slMode === 'price' ? 'USDT' : slMode === 'percent' ? '%' : 'USDT'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full pt-2 pb-3">
                    <ConnectButton.Custom>
                        {({ account, chain, openConnectModal, mounted }) => {
                            const ready = mounted;
                            const connected = ready && account && chain;
                            return (
                                <div className="flex space-x-3 w-full" {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                                    {!connected ? (
                                        <Button onClick={openConnectModal} className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors">Connect Wallet</Button>
                                    ) : totalBalanceVal <= 0 ? (
                                        <Button onClick={() => setIsFaucetOpen(true)} className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors">Claim Test Funds</Button>
                                    ) : (
                                        <>
                                            <Button onClick={() => handleTrade(true)} disabled={loading} className={`flex-1 font-bold ${loading ? 'bg-zinc-800' : 'bg-trading-blue hover:opacity-90'} text-white`}>{loading ? '...' : 'Buy'}</Button>
                                            <Button onClick={() => handleTrade(false)} disabled={loading} className={`flex-1 font-bold ${loading ? 'bg-zinc-800' : 'bg-trading-red hover:opacity-90'} text-white`}>{loading ? '...' : 'Sell'}</Button>
                                        </>
                                    )}
                                </div>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>

                <div className="text-xs space-y-1.5 pt-3 border-t border-border dark:border-zinc-800">
                    <div className="flex justify-between text-light-text dark:text-zinc-500"><span>Value</span><span className="text-foreground dark:text-zinc-200">${formatPrice(calculations.value)}</span></div>
                    <div className="flex justify-between text-light-text dark:text-zinc-500"><span>Cost (Margin)</span><span className="text-foreground dark:text-zinc-200">${formatPrice(calculations.cost)}</span></div>
                    <div className="flex justify-between text-light-text dark:text-zinc-500"><span>Commission</span><span className="text-foreground dark:text-zinc-200">${formatPrice(calculations.commission)}</span></div>
                    <div className="flex justify-between text-light-text dark:text-zinc-500"><span>Liq. Price</span><span className="text-foreground dark:text-zinc-400 text-[10px]">${formatPrice(calculations.liqPriceLong)} / ${formatPrice(calculations.liqPriceShort)}</span></div>
                </div>
            </div>

            <div className="flex-shrink-0 mx-4 mt-2 mb-3 p-4 h-[180px] bg-blue-50 dark:bg-zinc-900 rounded-lg relative overflow-hidden border border-transparent dark:border-zinc-800">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[33%]">
                    <Landmark className="w-40 h-40 text-blue-200 dark:text-zinc-800 opacity-40" />
                </div>

                <div className="relative z-10 flex flex-col items-end w-full h-full justify-between">
                    <div className="text-xs space-y-1.5 pt-1 w-full">
                        <div className="flex justify-between items-center w-full"><span className="text-light-text dark:text-zinc-500">Total:</span><span className="font-semibold text-foreground dark:text-white">${getDisplayValue(totalBalanceVal.toFixed(2))}</span></div>
                        <div className="flex justify-between items-center w-full"><span className="text-light-text dark:text-zinc-500">Available:</span><span className="font-semibold text-foreground dark:text-white">${getDisplayValue(availableBalanceVal.toFixed(2))}</span></div>
                        <div className="flex justify-between items-center w-full"><span className="text-light-text dark:text-zinc-500">Locked:</span><span className="font-semibold text-foreground dark:text-white">${getDisplayValue(lockedBalanceVal.toFixed(2))}</span></div>
                    </div>

                    <div className="w-full flex justify-end items-center gap-2 mt-4">
                        <DepositDialog className="h-8 border border-blue-600 hover:bg-blue-600/90 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800" />
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800" onClick={() => setShowBalance(!showBalance)}>
                            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            <FaucetDialog open={isFaucetOpen} onOpenChange={setIsFaucetOpen} />
        </div>
    );
};

export default OrderPanel;
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

// --- MAPPING DES TAILLES DE LOTS ---
// Clé = assetId, Valeur = quantité d'actif pour 1 lot au niveau de l'affichage
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01,    // btc_usdt
    1: 0.1,     // eth_usdt
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
    // Par défaut, tous les autres (actions, indices, forex) vaudront 1
};

// --- CONSTANTES TRADING ---
const TRADING_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B' as const;
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

// --- CONSTANTES VAULT ---
const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0' as const;
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
        const val = e.target.value;
        onChange(val);
    };

    const widthClass = isCompact 
        ? 'w-full text-center h-7 text-xs p-1 pr-5 dark:bg-black dark:border-zinc-800 dark:text-white dark:focus:border-zinc-600' 
        : 'w-full text-lg font-medium pr-10 dark:bg-black dark:border-zinc-800 dark:text-white dark:focus:border-zinc-600';
    const buttonWidth = isCompact ? 'w-5' : 'w-8';
    const iconSize = isCompact ? 'w-3 h-3' : 'w-4 h-4';

    return (
        <div className="relative flex items-center">
            <Input
                type="text"
                placeholder="0.00"
                value={value}
                onChange={handleInputChange}
                className={widthClass}
            />
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
}

const OrderPanel = ({
    selectedAsset,
    currentPrice,
    paymasterEnabled,
    onTogglePaymaster
}: OrderPanelProps) => {

    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [leverage, setLeverage] = useState(10);
    const [assetAmount, setAssetAmount] = useState<number | string>(1); // Remplace lotsDisplay
    const [limitPrice, setLimitPrice] = useState('');
    const [tpPrice, setTpPrice] = useState('');
    const [slPrice, setSlPrice] = useState('');
    const [localLoading, setLocalLoading] = useState(false);
    const [showBalance, setShowBalance] = useState(true); 

    const { refetchAll: refetchVault } = useVault();
    const { getConfigById } = useAssetConfig();
    const { address, chain: currentChain } = useAccount();
    const { executeOpenMarket, executePlaceOrder, isLoading: paymasterLoading } = usePaymaster();
    
    const { writeContractAsync } = useWriteContract();
    const { toast } = useToast();
    const publicClient = usePublicClient({ chainId: currentChain?.id });

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
    const lockedBalanceVal = totalBalanceVal - availableBalanceVal;

    const loading = localLoading || paymasterLoading;
    
    const finalAssetIdForTx = useMemo(() => {
        const id = Number(selectedAsset.id);
        return (isNaN(id) || id < 0) ? 0 : id;
    }, [selectedAsset.id]);

    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    // --- LOGIQUE DES LOTS ---
    const lotSizeInAsset = ASSET_LOT_SIZES[finalAssetIdForTx] || 1;
    const amountDecimals = Math.max(0, -Math.floor(Math.log10(lotSizeInAsset)));
    
    // Convertir l'input en lots réels pour le smart contract (Arrondi au plus proche)
    const actualLots = useMemo(() => {
        return Math.max(1, Math.round(Number(assetAmount) / lotSizeInAsset));
    }, [assetAmount, lotSizeInAsset]);

    // Montant effectif (pour recalculer le PnL, la marge et les coûts si l'utilisateur a rentré un montant bizarre)
    const effectiveAmount = actualLots * lotSizeInAsset;

    // Réinitialiser la quantité affichée au minimum valide quand on change d'actif
    useEffect(() => {
        setAssetAmount(lotSizeInAsset);
    }, [finalAssetIdForTx, lotSizeInAsset]);

    useEffect(() => {
        if (!isMarketOpen && orderType === "market") setOrderType("limit");
    }, [isMarketOpen, orderType]);

    const assetConfig = getConfigById(finalAssetIdForTx);

    const { priceDecimals, priceStep } = useMemo(() => {
        const decimals = Math.max(0, Math.round(Math.log10(1000000 / (assetConfig?.tick_size_usd6 || 10000))));
        return { priceDecimals: decimals, priceStep: 1 / (10 ** decimals) };
    }, [assetConfig]);

    useEffect(() => {
        if (currentPrice > 0 && (orderType === 'limit' || orderType === 'stop')) {
            setLimitPrice(currentPrice.toFixed(priceDecimals));
        }
    }, [selectedAsset.id, currentPrice, priceDecimals, orderType]);

    const calculations = useMemo(() => {
        const price = (orderType === 'limit' || orderType === 'stop') && limitPrice ? Number(limitPrice) : currentPrice;
        if (isNaN(price) || price <= 0 || effectiveAmount <= 0) return { value: 0, cost: 0, commission: 0, liqPriceLong: 0, liqPriceShort: 0 };
        
        // La valeur nominale est calculée sur le montant EFFECTIF (en unités d'actif) * le prix
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

    const handleTrade = async (longSide: boolean) => {
        if (!isMarketOpen && orderType === 'market') return toast({ title: 'Market Closed', variant: "destructive" });
        
        const numLimitPrice = Number(limitPrice);
        const numSlPrice = slEnabled && slPrice ? Number(slPrice) : undefined;
        const numTpPrice = tpEnabled && tpPrice ? Number(tpPrice) : undefined;
        const requiredMargin = calculations.cost * 1.01;

        if (availableBalanceVal < requiredMargin) return toast({ title: 'Insufficient Balance', variant: "destructive" });

        if (!paymasterEnabled) setLocalLoading(true);
        let txHash: Hash | string | undefined;

        try {
            const slX6 = numSlPrice ? Math.round(numSlPrice * 1000000) : 0;
            const tpX6 = numTpPrice ? Math.round(numTpPrice * 1000000) : 0;

            if (paymasterEnabled) {
                if (orderType === 'limit' || orderType === 'stop') {
                    const targetPriceX6 = Math.round(numLimitPrice * 1000000);
                    txHash = await executePlaceOrder({
                        assetId: finalAssetIdForTx,
                        isLong: longSide,
                        isLimit: orderType === 'limit',
                        leverage: leverage,
                        lotSize: actualLots, // Envoi en lot contractuel
                        targetPrice: targetPriceX6,
                        stopLoss: slX6,
                        takeProfit: tpX6
                    });
                } else {
                    txHash = await executeOpenMarket({
                        assetId: finalAssetIdForTx,
                        isLong: longSide,
                        leverage: leverage,
                        lotSize: actualLots, // Envoi en lot contractuel
                        stopLoss: slX6,
                        takeProfit: tpX6
                    });
                }
            } else {
                if (orderType === 'limit' || orderType === 'stop') {
                    const isLimit = orderType === 'limit'; 
                    const targetPriceX6 = Math.round(numLimitPrice * 1000000);

                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS, 
                        abi: TRADING_ABI, 
                        functionName: 'placeOrder',
                        args: [
                            finalAssetIdForTx, 
                            longSide, 
                            isLimit, 
                            leverage, 
                            actualLots, // Envoi en lot contractuel
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
                            longSide, 
                            leverage, 
                            actualLots, // Envoi en lot contractuel
                            BigInt(slX6), 
                            BigInt(tpX6), 
                            proof
                        ],
                    });
                }
                
                if (publicClient && txHash) await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
            }

            toast({ title: 'Order Placed', description: `${longSide ? 'Buy' : 'Sell'} order successful.` });
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
                        <div 
                            className={`py-1 mr-4 cursor-pointer transition ${orderType === "limit" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white" : "hover:text-foreground dark:hover:text-zinc-400"}`} 
                            onClick={() => setOrderType("limit")}
                        >
                            Limit
                        </div>
                        <div 
                            className={`py-1 mr-4 cursor-pointer transition ${orderType === "stop" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white" : "hover:text-foreground dark:hover:text-zinc-400"}`} 
                            onClick={() => setOrderType("stop")}
                        >
                            Stop
                        </div>
                        <div 
                            className={`py-1 mr-4 transition ${!isMarketOpen ? "opacity-50 cursor-not-allowed" : orderType === "market" ? "text-foreground dark:text-white border-b-2 border-foreground dark:border-white cursor-pointer" : "hover:text-foreground dark:hover:text-zinc-400 cursor-pointer"}`} 
                            onClick={() => isMarketOpen && setOrderType("market")}
                        >
                            Market
                        </div>
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
                        <StepController value={limitPrice} onChange={setLimitPrice} step={priceStep} decimals={priceDecimals} />
                    </div>
                )}

                {/* Amount basé sur la configuration de l'actif */}
                <div>
                    <span className="text-light-text dark:text-zinc-500 text-xs block mb-1">
                        Amount ({selectedAsset.symbol.split('/')[0]})
                    </span>
                    <StepController 
                        value={assetAmount} 
                        onChange={setAssetAmount} 
                        step={lotSizeInAsset} 
                        min={lotSizeInAsset} 
                        decimals={amountDecimals} 
                    />
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="flex items-center text-foreground dark:text-zinc-300 cursor-pointer mb-2">
                            <Checkbox checked={tpEnabled} onCheckedChange={(c) => setTpEnabled(c as boolean)} className="mr-2 dark:border-zinc-600 dark:data-[state=checked]:bg-zinc-200 dark:data-[state=checked]:text-black" />
                            <span className="text-sm">Take Profit</span>
                        </label>
                        {tpEnabled && <StepController value={tpPrice} onChange={setTpPrice} step={priceStep} decimals={priceDecimals} />}
                    </div>
                    <div>
                        <label className="flex items-center text-foreground dark:text-zinc-300 cursor-pointer mb-2">
                            <Checkbox checked={slEnabled} onCheckedChange={(c) => setSlEnabled(c as boolean)} className="mr-2 dark:border-zinc-600 dark:data-[state=checked]:bg-zinc-200 dark:data-[state=checked]:text-black" />
                            <span className="text-sm">Stop Loss</span>
                        </label>
                        {slEnabled && <StepController value={slPrice} onChange={setSlPrice} step={priceStep} decimals={priceDecimals} />}
                    </div>
                </div>

                <div className="flex space-x-3 pt-2 pb-3">
                    <Button onClick={() => handleTrade(true)} disabled={loading} className={`flex-1 font-bold ${loading ? 'bg-zinc-800' : 'bg-trading-blue hover:opacity-90'} text-white`}>{loading ? '...' : 'Buy'}</Button>
                    <Button onClick={() => handleTrade(false)} disabled={loading} className={`flex-1 font-bold ${loading ? 'bg-zinc-800' : 'bg-trading-red hover:opacity-90'} text-white`}>{loading ? '...' : 'Sell'}</Button>
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
                        <div className="flex justify-between items-center w-full">
                            <span className="text-light-text dark:text-zinc-500">Total:</span>
                            <span className="font-semibold text-foreground dark:text-white">${getDisplayValue(totalBalanceVal.toFixed(2))}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-light-text dark:text-zinc-500">Available:</span>
                            <span className="font-semibold text-foreground dark:text-white">${getDisplayValue(availableBalanceVal.toFixed(2))}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-light-text dark:text-zinc-500">Locked:</span>
                            <span className="font-semibold text-foreground dark:text-white">${getDisplayValue(lockedBalanceVal.toFixed(2))}</span>
                        </div>
                    </div>

                    <div className="w-full flex justify-end items-center gap-2 mt-4">
                        <DepositDialog className="h-8 border border-blue-600 hover:bg-blue-600/90 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800" />
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800" onClick={() => setShowBalance(!showBalance)}>
                            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderPanel;
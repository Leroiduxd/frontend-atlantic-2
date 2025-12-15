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
// Wagmi/Viem Imports
import { useWriteContract, useAccount, usePublicClient } from 'wagmi';
import { usePaymaster, PaymasterOpenParams } from "@/hooks/usePaymaster";
import { Landmark, Send, ChevronUp, ChevronDown, Fuel, Eye, EyeOff } from 'lucide-react'; 
import { Hash } from 'viem';
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { customChain } from "@/config/wagmi";
import { useVaultBalances } from "@/hooks/useVaultBalances";

// --- CONSTANTES GLOBALES (Unchanged) ---
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
// ---------------------------------------------------

// (StepController) - Réutilisé tel quel
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

    const widthClass = isCompact ? 'w-full text-center h-7 text-xs p-1 pr-5' : 'w-full text-lg font-medium pr-10';
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
            <div className={`absolute right-0 top-0 h-full flex flex-col justify-center border-l border-border`}>
                <Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 border-b border-border/80 rounded-none rounded-tr-sm`} onClick={() => handleStep(step)}>
                    <ChevronUp className={iconSize} />
                </Button>
                <Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 rounded-none rounded-br-sm`} onClick={() => handleStep(-step)}>
                    <ChevronDown className={iconSize} />
                </Button>
            </div>
        </div>
    );
};
// ====================================================================


type OrderType = "limit" | "market";

// UTILITY FUNCTION: Fetch Proof (reused)
const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch proof for asset ${assetId}. Status: ${response.status}`);
    }

    const data = await response.json();
    const proof = data.proof as string;

    if (!proof || proof.length <= 2 || !proof.startsWith('0x')) {
        throw new Error("Invalid proof received from API.");
    }

    return proof as Hash;
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

    // --- STATES ---
    const [orderType, setOrderType] = useState<OrderType>("limit");
    const [tpEnabled, setTpEnabled] = useState(false);
    const [slEnabled, setSlEnabled] = useState(false);
    const [leverage, setLeverage] = useState(10);
    const [lotsDisplay, setLotsDisplay] = useState(0.01);
    const [limitPrice, setLimitPrice] = useState('');
    const [tpPrice, setTpPrice] = useState('');
    const [slPrice, setSlPrice] = useState('');
    const [isHoveringFuel, setIsHoveringFuel] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);
    const [showBalance, setShowBalance] = useState(true); 

    // --- HOOKS ---
    const { balance, available, locked, refetchAll } = useVault();
    const { getConfigById, convertDisplayToLots } = useAssetConfig();
    const { isConnected, chain: currentChain, address: account } = useAccount();
    const { executeGaslessOrder, isLoading: paymasterLoading } = usePaymaster();
    const { writeContractAsync } = useWriteContract();
    const { toast } = useToast();
    
    // FIX: Use usePublicClient() instead of useConfig().publicClient
    const publicClient = usePublicClient({ chainId: currentChain?.id });

    const loading = localLoading || paymasterLoading;
    const finalAssetIdForTx = useMemo(() => {
        const n = Number(selectedAsset.id);
        return Number.isFinite(n) ? n : -1;
    }, [selectedAsset.id]);
    const marketStatus = useMarketStatus(finalAssetIdForTx);
    const isMarketOpen = marketStatus.isOpen;

    // Si le marché est fermé, forcer l'ordre Limit
    useEffect(() => {
        if (!isMarketOpen && orderType === "market") {
            setOrderType("limit");
        }
    }, [isMarketOpen, orderType]);

    const assetConfig = getConfigById(finalAssetIdForTx);

    const { minLotSizeDisplay, lotStep, priceDecimals, priceStep } = useMemo(() => {
        const num = assetConfig?.lot_num || 1;
        const den = assetConfig?.lot_den || 100;
        const lotSize = num / den;
        const lotStep = lotSize;

        const tickSizeX6 = assetConfig?.tick_size_usd6 || 10000;
        const powerOfTen = Math.round(Math.log10(1000000 / tickSizeX6));
        const decimals = Math.max(0, powerOfTen);
        const step = 1 / (10 ** decimals);

        return {
            minLotSizeDisplay: lotSize,
            lotStep: lotStep,
            priceDecimals: decimals,
            priceStep: step,
        };
    }, [assetConfig]);


    useEffect(() => {
        setLotsDisplay(minLotSizeDisplay);
        if (currentPrice > 0) {
            if (orderType === 'limit') {
                setLimitPrice(currentPrice.toFixed(priceDecimals));
            }
        }
    }, [selectedAsset.id, currentPrice, minLotSizeDisplay, priceDecimals, orderType]);


    const handleLotsChange = (value: number) => {
        setLotsDisplay(value);
    };

    const calculations = useMemo(() => {
        const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;

        if (isNaN(price) || price <= 0 || lotsDisplay <= 0) {
            return { value: 0, cost: 0, liqPriceLong: 0, liqPriceShort: 0 };
        }

        const displayNotional = lotsDisplay * price;
        const liqPriceLong = price * (1 - 0.99 / leverage);
        const liqPriceShort = price * (1 + 0.99 / leverage);

        return {
            value: displayNotional,
            cost: displayNotional / leverage,
            liqPriceLong,
            liqPriceShort,
        };
    }, [lotsDisplay, leverage, limitPrice, currentPrice, orderType]);

    const formatPrice = (value: number) => {
        if (value === 0) return "0.00";
        return value.toFixed(priceDecimals > 5 ? 5 : priceDecimals || 2);
    };

    const getDisplayValue = useCallback((value: string | number) => {
        return showBalance ? value : '***';
    }, [showBalance]);

    /**
     * LOGIQUE DE TRADE MISE À JOUR : Support Paymaster
     */
    const handleTrade = async (longSide: boolean) => {

        // ... [Vérifications critiques omises pour la concision] ...
        if (!isMarketOpen && orderType === 'market') {
            return toast({ title: 'Market Closed', description: `Market orders are disabled when the market is closed. Please use a Limit order.`, variant: "destructive" });
        }
        if (finalAssetIdForTx < 0) {
            return toast({ title: 'Configuration Error', description: `Please select a valid trading pair.`, variant: "destructive", });
        }

        const numLimitPrice = Number(limitPrice);
        const numSlPrice = slEnabled ? Number(slPrice) : undefined;
        const numTpPrice = tpEnabled ? Number(tpPrice) : undefined;

        if (orderType === 'limit' && (isNaN(numLimitPrice) || numLimitPrice <= 0)) {
            return toast({ title: 'Input Error', description: 'Please enter a valid Limit Price.', variant: "destructive" });
        }
        if (lotsDisplay < minLotSizeDisplay) {
            return toast({ title: 'Input Error', description: `Minimum lot size is ${minLotSizeDisplay}.`, variant: "destructive" });
        }

        const requiredMargin = calculations.cost;
        const requiredMarginWithBuffer = requiredMargin * 1.01;
        const availableBalance = Number(available);

        if (availableBalance < requiredMarginWithBuffer) {
            return toast({
                title: 'Insufficient Balance',
                description: `Required Margin: $${formatPrice(requiredMarginWithBuffer)}. Available: $${availableBalance}.`,
                variant: "destructive",
            });
        }
        // ... [Fin des vérifications] ...

        if (!paymasterEnabled) {
            setLocalLoading(true);
        }

        let txHash: Hash | string | undefined;

        try {
            const actualLots = convertDisplayToLots(lotsDisplay, finalAssetIdForTx);
            let toastId: string | number | undefined;

            if (paymasterEnabled) {
                // --- 🅰️ MÉTHODE PAYMASTER (Gasless) ---

                toastId = toast({
                    title: 'Awaiting Signature...',
                    description: 'Please approve the transaction in your wallet to sign the order.',
                    duration: 90000,
                }).id;

                const paymasterParams: Omit<PaymasterOpenParams, 'type'> = {
                    assetId: finalAssetIdForTx,
                    longSide,
                    leverage,
                    lots: actualLots,
                    orderType,
                    price: orderType === 'limit' ? numLimitPrice : undefined,
                    slPrice: numSlPrice,
                    tpPrice: numTpPrice,
                };

                try {
                    txHash = await executeGaslessOrder(paymasterParams);

                    toast({
                        id: toastId,
                        title: 'Order Sent (Gasless)',
                        description: `Transaction pending via Paymaster. Tx Hash: ${txHash.substring(0, 10)}...`,
                        variant: 'default',
                        duration: 90000,
                    });

                } catch (paymasterError: any) {
                    const errorMsg = paymasterError?.message || 'Transaction rejected or API failed.';
                    toast({
                        id: toastId,
                        title: 'Gasless Order Failed',
                        description: errorMsg.includes('User rejected') ? 'Transaction rejected by user.' : errorMsg,
                        variant: 'destructive',
                    });
                    throw paymasterError;
                }

            } else {
                // --- 🅱️ MÉTHODE TRADITIONNELLE (Wagmi) ---
                const slX6 = numSlPrice ? Math.round(numSlPrice * 1000000) : 0;
                const tpX6 = numTpPrice ? Math.round(numTpPrice * 1000000) : 0;

                if (orderType === 'limit') {
                    const targetX6 = Math.round(numLimitPrice * 1000000);

                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS,
                        abi: TRADING_ABI,
                        functionName: 'openLimit',
                        args: [
                            finalAssetIdForTx,
                            longSide,
                            leverage,
                            actualLots,
                            BigInt(targetX6),
                            BigInt(slX6),
                            BigInt(tpX6)
                        ],
                        chain: currentChain,
                        account,
                    });

                } else { // Market Order
                    const proof = await getMarketProof(finalAssetIdForTx);

                    txHash = await writeContractAsync({
                        address: TRADING_ADDRESS,
                        abi: TRADING_ABI,
                        functionName: 'openMarket',
                        args: [
                            proof,
                            finalAssetIdForTx,
                            longSide,
                            leverage,
                            actualLots,
                            BigInt(slX6),
                            BigInt(tpX6)
                        ],
                        chain: currentChain,
                        account,
                    });
                }

                // FIX: Update receipt-waiting logic to use the new publicClient hook and handle undefined client gracefully.
                if (!txHash) {
                    throw new Error("txHash missing after writeContractAsync.");
                }

                toastId = toast({
                    title: 'Transaction Sent',
                    description: `Waiting for ${currentChain?.name || 'chain'} confirmation...`,
                    duration: 90000,
                }).id;

                // Wait for receipt only if a public client is available.
                // If not available, do NOT throw: the tx has been sent and the explorer link + refetch will handle UI update.
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });

                    toast({
                        id: toastId,
                        title: 'Transaction Confirmed',
                        description: 'Your transaction has been successfully mined.',
                        variant: 'default',
                        duration: 3000,
                    });
                } else {
                    // Optional: update the toast to indicate tx is sent but confirmation is not being tracked.
                    toast({
                        id: toastId,
                        title: 'Transaction Sent',
                        description: 'Transaction sent. Confirmation tracking is temporarily unavailable.',
                        variant: 'default',
                        duration: 5000,
                    });
                }
            }

            // 4. Afficher le succès final (commun)
            const explorerUrl = txHash ? `https://atlantic.pharosscan.xyz/tx/${txHash}` : undefined;
            const successTitle = paymasterEnabled ? 'Gasless Order Placed' : 'Order Placed';

            toast({
                id: toastId,
                title: successTitle,
                description: (
                    <span className="flex items-center space-x-1">
                        <span>{longSide ? 'Buy' : 'Sell'} order placed successfully.</span>
                        {explorerUrl && (
                            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-trading-blue underline flex items-center">
                                View Transaction <Send className="w-3 h-3 ml-1" />
                            </a>
                        )}
                    </span>
                ),
                duration: 5000,
            });

            // Réinitialisation de l'interface
            setLimitPrice(currentPrice.toFixed(priceDecimals));
            setTpPrice('');
            setSlPrice('');
            setTpEnabled(false);
            setSlEnabled(false);
            setLotsDisplay(minLotSizeDisplay);

            setTimeout(() => refetchAll(), 2000);

        } catch (error: any) {
            console.error("Trade Error:", error);

            if (!paymasterEnabled) {
                let errorMsg = error?.message || 'Transaction failed.';

                if (errorMsg.includes('User rejected the request')) {
                    errorMsg = 'Transaction rejected by user.';
                } else if (errorMsg.includes('revert')) {
                    errorMsg = 'Transaction failed (revert).';
                }

                toast({
                    title: 'Order failed',
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        } finally {
            if (!paymasterEnabled) {
                setLocalLoading(false);
            }
        }
    };


    return (
        <div className="w-[320px] h-full flex flex-col border-l border-border shadow-md bg-card">

            {/* 🛑 BANNER D'AVERTISSEMENT */}
            <MarketClosedBanner status={marketStatus} />

            {/* Order Panel Content (Scrollable) */}
            <div className="flex-grow p-4 space-y-5 overflow-y-auto custom-scrollbar">

                {/* 1. Tabs (Limit, Market) AND Paymaster + Leverage */}
                <div className="flex justify-between items-center border-b border-border text-muted-foreground font-medium text-sm pt-1 pb-2">

                    {/* Côté Gauche : Tabs Limit / Market */}
                    <div className="flex">
                        <div
                            className={`py-1 mr-4 cursor-pointer transition duration-150 ${orderType === "limit"
                                    ? "text-foreground border-b-2 border-foreground"
                                    : "hover:text-foreground"
                                }`}
                            onClick={() => setOrderType("limit")}
                        >
                            Limit
                        </div>
                        <div
                            className={`py-1 mr-4 transition duration-150 ${!isMarketOpen
                                    ? "text-muted-foreground/50 cursor-not-allowed"
                                    : orderType === "market"
                                        ? "text-foreground border-b-2 border-foreground cursor-pointer"
                                        : "hover:text-foreground cursor-pointer"
                                }`}
                            onClick={() => isMarketOpen && setOrderType("market")}
                        >
                            Market
                        </div>
                    </div>

                    {/* Côté Droit : Leverage Input + Fuel Button */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0">
                            <div className="w-20">
                                <StepController
                                    value={leverage}
                                    onChange={setLeverage}
                                    step={1}
                                    min={1}
                                    max={100}
                                    decimals={0}
                                    isCompact={true}
                                />
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 rounded-md transition-colors ${
                                    paymasterEnabled
                                        ? "bg-amber-400 border-none text-white hover:bg-amber-500"
                                        : "bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                                    }`}
                                onClick={onTogglePaymaster}
                                onMouseEnter={() => setIsHoveringFuel(true)}
                                onMouseLeave={() => setIsHoveringFuel(false)}
                            >
                                <Fuel className="w-4 h-4" />
                            </Button>

                            {isHoveringFuel && (
                                <div className="absolute z-50 top-full right-0 mt-2 w-max max-w-[200px] rounded-md bg-white p-2 text-xs text-gray-800 shadow-lg border border-gray-200">
                                    <p className="font-semibold text-right">Gasless Paymaster</p>
                                    <p className="mt-1 text-right">Brokex pays network fees for you.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Order Input based on type */}
                {orderType === "limit" && (
                    <div>
                        <span className="text-light-text text-xs block mb-1">Limit Price (USD)</span>
                        <StepController
                            value={limitPrice}
                            onChange={setLimitPrice}
                            step={priceStep}
                            decimals={priceDecimals}
                        />
                    </div>
                )}
                {orderType === "market" && !isMarketOpen && (
                    <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm font-medium">
                        Market Orders not allowed while market is closed.
                    </div>
                )}


                {/* 3. Amount Input (Lots) */}
                <div>
                    <span className="text-light-text text-xs block mb-1">
                        Lots ({selectedAsset.symbol.split('/')[0] || 'BTC'})
                    </span>
                    <StepController
                        value={lotsDisplay}
                        onChange={handleLotsChange}
                        step={lotStep}
                        min={minLotSizeDisplay}
                        decimals={lotStep >= 1 ? 0 : 2}
                    />
                </div>

                {/* 4. Take Profit / Stop Loss */}
                <div className="space-y-3">
                    {/* Take Profit Toggle */}
                    <div>
                        <label className="flex items-center text-foreground cursor-pointer mb-2">
                            <Checkbox
                                checked={tpEnabled}
                                onCheckedChange={(checked) => setTpEnabled(checked as boolean)}
                                className="mr-2"
                            />
                            <span className="text-sm font-medium">Take Profit</span>
                        </label>
                        {tpEnabled && (
                            <StepController
                                value={tpPrice}
                                onChange={setTpPrice}
                                step={priceStep}
                                decimals={priceDecimals}
                            />
                        )}
                    </div>

                    {/* Stop Loss Toggle */}
                    <div>
                        <label className="flex items-center text-foreground cursor-pointer mb-2">
                            <Checkbox
                                checked={slEnabled}
                                onCheckedChange={(checked) => setSlEnabled(checked as boolean)}
                                className="mr-2"
                            />
                            <span className="text-sm font-medium">Stop Loss</span>
                        </label>
                        {slEnabled && (
                            <StepController
                                value={slPrice}
                                onChange={setSlPrice}
                                step={priceStep}
                                decimals={priceDecimals}
                            />
                        )}
                    </div>
                </div>

                {/* 5. Buy / Sell Buttons */}
                <div className="flex space-x-3 pt-2 pb-3">
                    <Button
                        onClick={() => handleTrade(true)}
                        disabled={loading || (orderType === 'market' && !isMarketOpen)}
                        className={`flex-1 ${loading || (orderType === 'market' && !isMarketOpen) ? 'bg-gray-400' : 'bg-trading-blue hover:bg-trading-blue/90'} text-white font-bold shadow-md`}
                    >
                        {loading ? 'Processing...' : 'Buy'}
                    </Button>
                    <Button
                        onClick={() => handleTrade(false)}
                        disabled={loading || (orderType === 'market' && !isMarketOpen)}
                        className={`flex-1 ${loading || (orderType === 'market' && !isMarketOpen) ? 'bg-gray-400' : 'bg-trading-red hover:bg-trading-red/90'} text-white font-bold shadow-md`}
                    >
                        {loading ? 'Processing...' : 'Sell'}
                    </Button>
                </div>

                {/* 6. Account Details (Calculations) */}
                <div className="text-xs space-y-1.5 pt-3 border-t border-border">
                    <div className="flex justify-between text-light-text">
                        <span>Value</span>
                        <span className="text-foreground">${formatPrice(calculations.value)}</span>
                    </div>
                    <div className="flex justify-between text-light-text">
                        <span>Cost (Margin)</span>
                        <span className="text-foreground">${formatPrice(calculations.cost)}</span>
                    </div>
                    <div className="flex justify-between text-light-text">
                        <span>Est. Liq. Price (Long/Short)</span>
                        <span className="text-foreground text-[10px]">
                            ${formatPrice(calculations.liqPriceLong)} / ${formatPrice(calculations.liqPriceShort)}
                        </span>
                    </div>
                </div>
            </div>

            {/* 7. Deposit Info (Landmark Panel) - INVERSION DES BOUTONS */}
            <div className="flex-shrink-0 mx-4 mt-2 mb-4 p-4 h-[200px] bg-blue-50 rounded-lg relative overflow-hidden">

                {/* Logo de banque en fond (Landmark) */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[33%]">
                    <Landmark className="w-48 h-48 text-blue-200 opacity-70" />
                </div>

                {/* Contenu - Aligné à droite */}
                <div className="relative z-10 flex flex-col items-end w-full h-full justify-between">

                    {/* Informations (Haut à droite) */}
                    <div className="text-xs space-y-1.5 pt-1 w-full">
                        
                        {/* Affichage des soldes conditionnel */}
                        <div className="flex justify-between items-center w-full">
                        <span className="text-light-text min-w-[80px] text-left">Total Balance:</span>
                            <span className="font-semibold text-foreground">${getDisplayValue(balance)}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-light-text min-w-[80px] text-left">Available:</span>
                            <span className="font-semibold text-foreground">${getDisplayValue(available)}</span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                            <span className="text-light-text min-w-[80px] text-left">Locked Margin:</span>
                            <span className="font-semibold text-foreground">${getDisplayValue(locked)}</span>
                        </div>
                    </div>

                    {/* Bouton Deposit/Wallet et Eye/EyeOff (Bas à droite, alignés) */}
                    <div className="w-full flex justify-end items-center gap-2 mt-4">

                        {/* 1. DepositDialog (À GAUCHE) */}
                        <DepositDialog className="h-8 border border-blue-600 hover:bg-blue-600/90" />
                        {/* 2. Bouton Eye/EyeOff (À DROITE) */}
                        <Button
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-800 border-blue-600 bg-blue-100 hover:bg-blue-200"
                            onClick={() => setShowBalance(prev => !prev)}
                            title={showBalance ? "Hide Balance" : "Show Balance"}
                        >
                            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderPanel;
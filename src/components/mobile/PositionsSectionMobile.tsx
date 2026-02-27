"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/useBrokexPaymaster"; // Mis à jour avec le bon chemin
import { EditStopsDialog } from "@/components/EditStopsDialog";
import { useAccount, useWriteContract } from 'wagmi';
import { Loader2, Plus, Minus, Check, X } from 'lucide-react';

// --- MAPPING DES PAIRES (Ajouté du PC) ---
const PAIR_MAP: { [key: number]: string } = {
  6004:'aapl_usd', 6005:'amzn_usd', 6010:'coin_usd', 6003:'goog_usd',
  6011:'gme_usd', 6009:'intc_usd', 6059:'ko_usd', 6068:'mcd_usd',
  6001:'msft_usd', 6066:'ibm_usd', 6006:'meta_usd', 6002:'nvda_usd',
  6000:'tsla_usd', 5010:'aud_usd', 5000:'eur_usd', 5002:'gbp_usd',
  5013:'nzd_usd', 5011:'usd_cad', 5012:'usd_chf', 5001:'usd_jpy',
  5501:'xag_usd', 5500:'xau_usd', 0:'btc_usdt', 1:'eth_usdt',
  10:'sol_usdt', 14:'xrp_usdt', 5:'avax_usdt', 3:'doge_usdt',
  15:'trx_usdt', 16:'ada_usdt', 90:'sui_usdt', 2:'link_usdt',
  6034:'nike_usd', 6113:'spdia_usd', 6114:'qqqm_usd', 6115:'iwm_usd'
};

// --- CONFIGURATION SMART CONTRACT ---
const PAYMASTER_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B'; // Mis à jour avec l'adresse du PC
const PAYMASTER_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "int32", "name": "lotsToClose", "type": "int32" },
      { "internalType": "bytes", "name": "oracleProof", "type": "bytes" }
    ],
    "name": "closePositionMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "uint64", "name": "amount6", "type": "uint64" }
    ],
    "name": "addMargin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "uint48", "name": "newSL", "type": "uint48" },
      { "internalType": "uint48", "name": "newTP", "type": "uint48" }
    ],
    "name": "updateSLTP",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// --- UTILS ---
const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch proof");
    const data = await response.json();
    return data.proof as Hash; 
};

const formatAssetPrice = (valueX6: number, assetId: number, symbolMap: any): string => {
    if (valueX6 === 0) return "0.00";
    const assetInfo = symbolMap[assetId];
    const value = valueX6 / 1000000; 
    return value.toFixed(assetInfo?.priceDecimals || 2);
};

const formatUSD = (valueX6: number): string => {
    if (!valueX6 || valueX6 === 0) return "0.00";
    const value = valueX6 / 1000000;
    return value.toFixed(2);
};

const formatDate = (timestamp: number) => {
    try { return format(new Date(timestamp * 1000), "yyyy-MM-dd HH:mm"); } 
    catch { return "---"; }
};

// =====================================================================
// 📱 COMPOSANTS CARTES MOBILES
// =====================================================================

// 1. Position Active
const PositionCardMobile = ({ position, onClose, onAddMargin, onEdit, symbolMap, getDisplaySymbol, isActionDisabled }: any) => {
    const maxLots = position.lots - position.closed_lots;
    const [isClosing, setIsClosing] = useState(false);
    const [lotsInput, setLotsInput] = useState(maxLots);
    
    const [isAddingMargin, setIsAddingMargin] = useState(false);
    const [marginInput, setMarginInput] = useState(10);

    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    
    const pnlClass = isPNLPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
    const sideClass = position.long_side 
        ? 'text-blue-600 bg-blue-100 dark:bg-blue-500/10' 
        : 'text-red-600 bg-red-100 dark:bg-red-500/10';
    
    const entryPrice = formatAssetPrice(position.entry_x6, position.asset_id, symbolMap);
    const liqPrice = position.liq_x6 > 0 ? formatAssetPrice(position.liq_x6, position.asset_id, symbolMap) : '---';
    
    return (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                    <span className="font-bold text-base dark:text-white">{getDisplaySymbol(position.assetSymbol, position.asset_id)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit mt-1 ${sideClass}`}>
                        {position.long_side ? 'LONG' : 'SHORT'} {position.leverage_x}x
                    </span>
                </div>
                <div className="text-right">
                    <div className={`font-bold text-lg ${pnlClass}`}>
                        {isPNLPositive ? '+' : ''}{pnlUsdText} <span className="text-xs text-slate-400">USD</span>
                    </div>
                    <span className={`text-xs font-semibold ${pnlClass}`}>({roePercentText}%)</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-y-3 text-xs mb-4">
                <div>
                    <span className="text-slate-400 block mb-0.5">Entry</span>
                    <span className="font-mono dark:text-zinc-200">{entryPrice}</span>
                </div>
                <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Mark</span>
                    <span className="font-mono dark:text-zinc-200">{position.currentPrice}</span>
                </div>
                <div>
                    <span className="text-slate-400 block mb-0.5">Size</span>
                    <span className="font-mono dark:text-zinc-200">{position.size}</span>
                </div>
                <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Liq. Price</span>
                    <span className="font-mono text-red-500">{liqPrice}</span>
                </div>
                <div>
                    <span className="text-slate-400 block mb-0.5">Margin</span>
                    <span className="font-mono dark:text-zinc-200">${formatUSD(position.margin_usd6)}</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {/* Actions primaires */}
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onEdit(position)}
                        disabled={isActionDisabled}
                        className="flex-1 h-9 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                        TP/SL
                    </Button>
                    
                    {!isAddingMargin ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setIsAddingMargin(true); setMarginInput(10); setIsClosing(false); }}
                            disabled={isActionDisabled}
                            className="flex-1 h-9 text-xs font-semibold text-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-blue-400"
                        >
                            + Margin
                        </Button>
                    ) : (
                        <div className="flex-1 flex items-center justify-between h-9 bg-gray-50 dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 rounded-md px-1">
                            <button onClick={() => setMarginInput(prev => Math.max(1, prev - 10))} className="p-1 text-zinc-500"><Minus size={14}/></button>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">${marginInput}</span>
                            <button onClick={() => setMarginInput(prev => prev + 10)} className="p-1 text-zinc-500"><Plus size={14}/></button>
                            <div className="flex gap-1 ml-1 border-l pl-1">
                                <button onClick={() => { onAddMargin(position.id, marginInput); setIsAddingMargin(false); }} className="p-1 text-blue-600"><Check size={14}/></button>
                                <button onClick={() => setIsAddingMargin(false)} className="p-1 text-zinc-500"><X size={14}/></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Close Button / Close Selector */}
                {!isClosing ? (
                    <Button 
                        size="sm" 
                        onClick={() => { setIsClosing(true); setLotsInput(maxLots); setIsAddingMargin(false); }}
                        disabled={isActionDisabled}
                        className="w-full h-9 text-xs font-bold bg-slate-900 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                        {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Close Position'}
                    </Button>
                ) : (
                    <div className="flex items-center justify-between h-9 bg-gray-50 dark:bg-zinc-900 border border-red-300 dark:border-red-900 rounded-md px-2">
                        <button onClick={() => setLotsInput(prev => Math.max(1, prev - 1))} className="p-1 text-zinc-500"><Minus size={14}/></button>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{lotsInput} Lot(s)</span>
                        <button onClick={() => setLotsInput(prev => Math.min(maxLots, prev + 1))} className="p-1 text-zinc-500"><Plus size={14}/></button>
                        <div className="flex gap-2 ml-2 border-l pl-2">
                            <button onClick={() => { onClose(position.id, position.asset_id, lotsInput); setIsClosing(false); }} className="p-1 text-blue-600"><Check size={16}/></button>
                            <button onClick={() => setIsClosing(false)} className="p-1 text-zinc-500"><X size={16}/></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// 2. Pending Order
const OrderCardMobile = ({ order, onCancel, symbolMap, getDisplaySymbol, isActionDisabled }: any) => {
    const sideClass = order.long_side 
        ? 'text-blue-600 bg-blue-100 dark:bg-blue-500/10' 
        : 'text-red-600 bg-red-100 dark:bg-red-500/10';

    return (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-sm dark:text-white">{getDisplaySymbol(order.assetSymbol, order.asset_id)}</span>
                <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sideClass}`}>
                        {order.orderTypeString.toUpperCase()} {order.long_side ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">{formatDate(order.created_at)}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-y-2 text-xs mb-4">
                <div>
                    <span className="text-slate-400 block mb-0.5">Price</span>
                    <span className="font-mono dark:text-zinc-200">{formatAssetPrice(order.target_x6, order.asset_id, symbolMap)}</span>
                </div>
                <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Amount</span>
                    <span className="font-mono dark:text-zinc-200">{order.size}</span>
                </div>
                <div>
                    <span className="text-slate-400 block mb-0.5">Margin</span>
                    <span className="font-mono dark:text-zinc-200">${formatUSD(order.margin_usd6)}</span>
                </div>
            </div>

            <Button 
                variant="secondary"
                size="sm" 
                onClick={() => onCancel(order.id)}
                disabled={isActionDisabled}
                className="w-full h-8 text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300"
            >
                {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Cancel Order'}
            </Button>
        </div>
    );
};

// 3. History Card (Closed/Cancelled)
const HistoryCardMobile = ({ item, type, symbolMap, getDisplaySymbol }: any) => {
    const isClosed = type === 'closed';
    const isPNLPositive = item.pnl_usd6 !== null && item.pnl_usd6 >= 0;
    
    const pnlClass = isPNLPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
    const sideText = item.long_side ? 'LONG' : 'SHORT';
    const sideColor = item.long_side ? 'text-blue-500' : 'text-red-500';

    return (
        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 mb-2 shadow-sm opacity-80">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-xs dark:text-white">{getDisplaySymbol(item.assetSymbol, item.asset_id)}</span>
                    <span className={`text-[10px] font-bold ${sideColor}`}>{sideText}</span>
                </div>
                <span className="text-[10px] text-slate-400">{formatDate(item.created_at)}</span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
                <div>
                    {isClosed ? (
                        <span className="font-mono dark:text-zinc-300">
                            Entry: {formatAssetPrice(item.entry_x6, item.asset_id, symbolMap)}
                        </span>
                    ) : (
                        <span className="font-mono text-slate-500">Cancelled</span>
                    )}
                </div>
                
                {isClosed && (
                    <div className="text-right">
                        <span className={`font-bold ${pnlClass}`}>
                            {item.pnl_usd6 ? `${isPNLPositive ? '+' : ''}$${formatUSD(item.pnl_usd6)}` : '-'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// =====================================================================
// 🌟 COMPOSANT PRINCIPAL (Props ajoutées pour matcher PC)
// =====================================================================

interface PositionsSectionMobileProps {
    paymasterEnabled?: boolean;
    currentAssetId?: number | null;
    currentAssetSymbol?: string;
}

export const PositionsSectionMobile: React.FC<PositionsSectionMobileProps> = ({
    paymasterEnabled = false,
    currentAssetId = null,
    currentAssetSymbol = ""
}) => {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "closed" | "cancelled">("positions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  // States Données
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  // Hooks
  const { address } = useAccount();
  const { toast } = useToast();
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 
  
  // WAGMI & Paymaster Contracts
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { 
    executeCloseMarket, 
    executeAddMargin, 
    executeUpdateSLTP, 
    executeCancelOrder, 
    isLoading: paymasterLoading 
  } = usePaymaster();

  // ------------------------------------------------------------------
  //  FETCHING LOGIC API (IDENTIQUE AU PC)
  // ------------------------------------------------------------------
  const fetchTrades = async () => {
    if (!address) return;
    setIsLoadingTrades(true);
    try {
        const resIds = await fetch(`https://api.brokex.trade/trader/${address}/ids?state=all`);
        if (!resIds.ok) throw new Error("Failed to fetch trade IDs");
        const { ids } = await resIds.json();

        const detailPromises = ids.map((id: number) => 
            fetch(`https://api.brokex.trade/trade/${id}`).then(r => r.json())
        );
        
        const trades = await Promise.all(detailPromises);
        setRawTrades(trades.filter(t => !t.error));
    } catch (e) {
        console.error("Error fetching trades from API:", e);
    } finally {
        setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [address]);

  // ------------------------------------------------------------------
  //  DATA PROCESSING (MAPPINGS & CALCULS - IDENTIQUE AU PC)
  // ------------------------------------------------------------------
  const assetSymbolMap = useMemo(() => {
    return assetConfigs.reduce((map, config) => {
        const powerOfTen = Math.round(Math.log10(1000000 / config.tick_size_usd6)); 
        const decimals = Math.max(0, powerOfTen);
        map[config.asset_id] = { 
            symbol: `${config.symbol}/USD`, 
            baseSymbol: config.symbol,     
            priceDecimals: decimals,
            priceStep: 1 / (10 ** decimals),
        };
        return map;
    }, {} as any);
  }, [assetConfigs]);

  const assetMap = useMemo(() => {
    const allAssets = getAssetsByCategory(wsData).crypto.concat(
        getAssetsByCategory(wsData).forex,
        getAssetsByCategory(wsData).commodities,
        getAssetsByCategory(wsData).stocks,
        getAssetsByCategory(wsData).indices
    );
    return allAssets.reduce((map, asset) => {
      const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
      map[asset.id] = { currentPrice: currentPrice ? parseFloat(currentPrice) : null, pair: asset.pair };
      return map;
    }, {} as any);
  }, [wsData]);

  const { openPositions, pendingOrders, closedPositions, cancelledOrders } = useMemo(() => {
    const open: any[] = [];
    const pending: any[] = [];
    const closed: any[] = [];
    const cancelled: any[] = [];

    rawTrades.forEach((t) => {
        const position = {
            id: Number(t.id),
            asset_id: Number(t.assetId),
            long_side: Boolean(t.isLong),
            is_limit: Boolean(t.isLimit),
            leverage_x: Number(t.leverage),
            entry_x6: Number(t.openPrice),
            margin_usd6: Number(t.marginUsdc),
            sl_x6: Number(t.stopLoss),
            tp_x6: Number(t.takeProfit),
            lots: Number(t.lotSize),
            closed_lots: Number(t.closedLotSize || 0), // Ajouté du PC
            created_at: Number(t.openTimestamp),
            target_x6: Number(t.openPrice),
            state: Number(t.state),
            closePriceX6: Number(t.closePrice),
            pnl_usd6: null as number | null
        };

        const assetInfo = assetSymbolMap[position.asset_id];
        const assetWs = assetMap[position.asset_id];
        const remainingLots = position.lots - position.closed_lots;

        // Calcul du prix de liquidation (Logique du PC)
        let liqPriceX6 = 0;
        if (position.entry_x6 > 0 && position.leverage_x > 0) {
            if (position.long_side) {
                liqPriceX6 = position.entry_x6 * (1 - 0.9 / position.leverage_x);
            } else {
                liqPriceX6 = position.entry_x6 * (1 + 0.9 / position.leverage_x);
            }
        }

        const enriched = {
            ...position,
            assetSymbol: assetInfo ? assetInfo.symbol : `Asset #${position.asset_id}`,
            size: convertLotsToDisplay(remainingLots, position.asset_id).toFixed(2),
            priceDecimals: assetInfo ? assetInfo.priceDecimals : 2,
            priceStep: assetInfo ? assetInfo.priceStep : 0.01,
            currentPrice: assetWs?.currentPrice ? assetWs.currentPrice.toFixed(assetInfo?.priceDecimals || 2) : '---',
            liq_x6: liqPriceX6,
            calculatedPNL: null as number | null,
            calculatedROE: null as number | null,
            orderTypeString: position.is_limit ? 'Limit' : 'Stop'
        };

        if (t.state === 1) { // OPEN
            if (assetWs?.currentPrice && position.entry_x6 > 0) {
                const currentP = assetWs.currentPrice;
                const entryP = position.entry_x6 / 1000000;
                const direction = position.long_side ? 1 : -1;
                const margin = position.margin_usd6 / 1000000;
                const roe = ((currentP / entryP) - 1) * direction * position.leverage_x * 100;
                const pnl = margin * (roe / 100);
                enriched.calculatedPNL = pnl;
                enriched.calculatedROE = roe;
            }
            open.push(enriched);
        } else if (t.state === 0) { // PENDING
            pending.push(enriched);
        } else if (t.state === 2) { // CLOSED
            const closeP = position.closePriceX6 / 1000000;
            const entryP = position.entry_x6 / 1000000;
            const margin = position.margin_usd6 / 1000000;
            const direction = position.long_side ? 1 : -1;
            if (entryP > 0) {
                const roe = ((closeP / entryP) - 1) * direction * position.leverage_x * 100;
                const pnl = margin * (roe / 100);
                enriched.pnl_usd6 = pnl * 1000000; 
            }
            closed.push(enriched);
        } else if (t.state === 3) { // CANCELLED
            cancelled.push(enriched);
        }
    });

    const sortFn = (a: any, b: any) => b.created_at - a.created_at;
    return { 
        openPositions: open.sort(sortFn), 
        pendingOrders: pending.sort(sortFn), 
        closedPositions: closed.sort(sortFn), 
        cancelledOrders: cancelled.sort(sortFn) 
    };

  }, [rawTrades, assetMap, assetSymbolMap, convertLotsToDisplay]);

  // --- ACTIONS LOGIC (IDENTIQUE AU PC) ---
  
  const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
      if (PAIR_MAP[assetId]) {
          return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
      }
      const baseSymbol = assetSymbol.split('/')[0];
      return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
  };

  const handleClosePosition = async (id: number, assetId: number, lotsToClose: number) => { 
    try {
        if (paymasterEnabled) {
           await executeCloseMarket({ tradeId: id, assetId, lotsToClose });
           toast({ title: "Close Request Sent", description: "Processing via Paymaster..." });
        } else {
           const proof = await getMarketProof(assetId); 
           await writeContractAsync({
               address: PAYMASTER_ADDRESS,
               abi: PAYMASTER_ABI,
               functionName: 'closePositionMarket',
               args: [BigInt(id), lotsToClose, proof]
           });
           toast({ title: "Close Order Sent", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddMargin = async (id: number, amount: number) => {
      try {
          const amount6Num = Math.floor(amount * 1e6); 
          if (paymasterEnabled) {
              await executeAddMargin({ tradeId: id, amount6: amount6Num });
              toast({ title: "Add Margin Sent", description: "Processing via Paymaster..." });
          } else {
              await writeContractAsync({
                  address: PAYMASTER_ADDRESS,
                  abi: PAYMASTER_ABI,
                  functionName: 'addMargin',
                  args: [BigInt(id), BigInt(amount6Num)]
              });
              toast({ title: "Add Margin Sent", description: "Transaction submitted." });
          }
          setTimeout(() => fetchTrades(), 3000);
      } catch (e: any) {
          toast({ title: "Error", description: e.message, variant: "destructive" });
      }
  };

  const handleUpdateStopsLogic = async ({ id, slPrice, tpPrice, isSLChanged, isTPChanged }: any) => { 
    try {
        const newSL = slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
        const newTP = tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;

        if (paymasterEnabled) {
            await executeUpdateSLTP({ tradeId: id, newSL, newTP });
            toast({ title: "Update Request Sent", description: "Processing via Paymaster..." });
        } else {
            await writeContractAsync({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'updateSLTP',
                args: [BigInt(id), BigInt(newSL), BigInt(newTP)]
            });
            toast({ title: "SL/TP Updated", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 2000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
        if (paymasterEnabled) {
            await executeCancelOrder({ tradeId: id });
            toast({ title: "Cancel Request Sent", description: "Processing via Paymaster..." });
        } else {
            await writeContractAsync({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'cancelOrder',
                args: [BigInt(id)]
            });
            toast({ title: "Cancel Order Sent", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const isActionDisabled = paymasterLoading || isWritePending;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black font-['Source_Code_Pro',_monospace]">
        
        {/* Navigation Onglets */}
        <div className="flex p-2 bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10 overflow-x-auto no-scrollbar gap-2">
            {[
                { id: 'positions', label: `Open (${openPositions.length})` },
                { id: 'orders', label: `Orders (${pendingOrders.length})` },
                { id: 'closed', label: `Closed` },
                { id: 'cancelled', label: `Cancelled` }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all 
                        ${activeTab === tab.id 
                            ? 'bg-slate-900 dark:bg-zinc-800 text-white' 
                            : 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Contenu Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
            {activeTab === 'positions' && (
                openPositions.length > 0 ? (
                    openPositions.map(pos => (
                        <PositionCardMobile 
                            key={pos.id} 
                            position={pos} 
                            onClose={handleClosePosition} 
                            onAddMargin={handleAddMargin}
                            onEdit={(p: any) => { setSelectedPosition(p); setEditDialogOpen(true); }}
                            symbolMap={assetSymbolMap}
                            getDisplaySymbol={getDisplaySymbol}
                            isActionDisabled={isActionDisabled}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No open positions.</div>
                )
            )}

            {activeTab === 'orders' && (
                pendingOrders.length > 0 ? (
                    pendingOrders.map(ord => (
                        <OrderCardMobile 
                            key={ord.id} 
                            order={ord} 
                            onCancel={handleCancelOrder}
                            symbolMap={assetSymbolMap}
                            getDisplaySymbol={getDisplaySymbol}
                            isActionDisabled={isActionDisabled}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No pending orders.</div>
                )
            )}

            {activeTab === 'closed' && (
                closedPositions.length > 0 ? (
                    closedPositions.map(item => (
                        <HistoryCardMobile 
                            key={item.id} 
                            item={item} 
                            type="closed"
                            symbolMap={assetSymbolMap}
                            getDisplaySymbol={getDisplaySymbol}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No closed positions.</div>
                )
            )}

            {activeTab === 'cancelled' && (
                cancelledOrders.length > 0 ? (
                    cancelledOrders.map(item => (
                        <HistoryCardMobile 
                            key={item.id} 
                            item={item} 
                            type="cancelled"
                            symbolMap={assetSymbolMap}
                            getDisplaySymbol={getDisplaySymbol}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No cancelled orders.</div>
                )
            )}
        </div>

        {/* Dialog Edit Stops (Resté en popup pour le mobile, meilleur UX) */}
        {selectedPosition && (
            <EditStopsDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                positionId={selectedPosition.id}
                currentSL={selectedPosition.sl_x6}
                currentTP={selectedPosition.tp_x6}
                entryPrice={selectedPosition.entry_x6}
                liqPrice={selectedPosition.liq_x6}
                isLong={selectedPosition.long_side}
                priceStep={selectedPosition.priceStep}
                priceDecimals={selectedPosition.priceDecimals}
                onConfirm={handleUpdateStopsLogic} 
                disabled={paymasterLoading} 
            />
        )}
    </div>
  );
};

export default PositionsSectionMobile;
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useTrading } from "@/hooks/useTrading"; 
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/usePaymaster"; 
import { EditStopsDialog } from "@/components/EditStopsDialog";
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { Loader2 } from 'lucide-react';

// --- CONFIGURATION SMART CONTRACT ---
const PAYMASTER_ADDRESS = '0x0afFdf07Cad8B950b823d8C953ee3d986a9A5FbC';
const PAYMASTER_ABI = [
  // VIEW: Get Trades Structs
  {
    "inputs": [
      { "internalType": "address", "name": "trader", "type": "address" },
      { "internalType": "uint256", "name": "cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "size", "type": "uint256" }
    ],
    "name": "getTradesPagination",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "trader", "type": "address" },
          { "internalType": "uint32", "name": "assetId", "type": "uint32" },
          { "internalType": "bool", "name": "isLong", "type": "bool" },
          { "internalType": "bool", "name": "isLimit", "type": "bool" },
          { "internalType": "uint8", "name": "leverage", "type": "uint8" },
          { "internalType": "uint48", "name": "openPrice", "type": "uint48" },
          { "internalType": "uint8", "name": "state", "type": "uint8" },
          { "internalType": "uint32", "name": "openTimestamp", "type": "uint32" },
          { "internalType": "uint128", "name": "fundingIndex", "type": "uint128" },
          { "internalType": "uint48", "name": "closePrice", "type": "uint48" },
          { "internalType": "int32", "name": "lotSize", "type": "int32" },
          { "internalType": "uint48", "name": "stopLoss", "type": "uint48" },
          { "internalType": "uint48", "name": "takeProfit", "type": "uint48" },
          { "internalType": "uint64", "name": "lpLockedCapital", "type": "uint64" },
          { "internalType": "uint64", "name": "marginUsdc", "type": "uint64" }
        ],
        "internalType": "struct IBrokexCore.Trade[]",
        "name": "_trades",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "total", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // VIEW: Get IDs
  {
    "inputs": [
        { "internalType": "address", "name": "", "type": "address" },
        { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "traderTradeIds",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // WRITE: Actions
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
      { "internalType": "bytes", "name": "oracleProof", "type": "bytes" }
    ],
    "name": "closePositionMarket",
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

// --- HELPERS FORMATAGE ---
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
const PositionCardMobile = ({ position, onAction, onEdit, symbolMap, getDisplaySymbol, isActionDisabled }: any) => {
    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    
    // THEME ROUGE / BLEU
    const pnlClass = isPNLPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
    const sideClass = position.long_side 
        ? 'text-blue-600 bg-blue-100 dark:bg-blue-500/10' 
        : 'text-red-600 bg-red-100 dark:bg-red-500/10';
    
    const entryPrice = formatAssetPrice(position.entry_x6, position.asset_id, symbolMap);
    
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
                    <span className="text-slate-400 block mb-0.5">Margin</span>
                    <span className="font-mono dark:text-zinc-200">${formatUSD(position.margin_usd6)}</span>
                </div>
            </div>

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
                <Button 
                    size="sm" 
                    onClick={() => onAction(position)}
                    disabled={isActionDisabled}
                    className="flex-1 h-9 text-xs font-bold bg-slate-900 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                    {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Close'}
                </Button>
            </div>
        </div>
    );
};

// 2. Pending Order
const OrderCardMobile = ({ order, onCancel, symbolMap, getDisplaySymbol, isActionDisabled }: any) => {
    // THEME ROUGE / BLEU
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
    
    // THEME ROUGE / BLEU
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
// 🌟 COMPOSANT PRINCIPAL
// =====================================================================

export const PositionsSectionMobile = () => {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "closed" | "cancelled">("positions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  // States Données
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  // Hooks
  const { address } = useAccount();
  const { toast } = useToast();
  const { executeGaslessAction, isLoading: paymasterLoading } = usePaymaster();
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 
  
  // WAGMI Contracts
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { updateStops } = useTrading(); // Pour l'update SL/TP non gasless

  // ------------------------------------------------------------------
  //  FETCHING LOGIC (COPIÉE DU PC)
  // ------------------------------------------------------------------
  const fetchTrades = async () => {
    if (!address || !publicClient) return;
    setIsLoadingTrades(true);
    try {
        const cursor = 0n;
        const size = 50n; 

        // 1. Get Structs
        const result = await publicClient.readContract({
            address: PAYMASTER_ADDRESS,
            abi: PAYMASTER_ABI,
            functionName: 'getTradesPagination',
            args: [address, cursor, size]
        });
        const trades = result[0];
        
        // 2. Get IDs
        const idPromises = trades.map((_, i) => 
            publicClient.readContract({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'traderTradeIds',
                args: [address, cursor + BigInt(i)]
            })
        );
        const ids = await Promise.all(idPromises);

        // 3. Merge
        const merged = trades.map((trade, i) => ({ ...trade, realId: ids[i] }));
        setRawTrades(merged);

    } catch (e) {
        console.error("Error fetching trades:", e);
    } finally {
        setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [address, publicClient]);

  // ------------------------------------------------------------------
  //  DATA PROCESSING (MAPPINGS & CALCULS)
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
            id: Number(t.realId), // REAL ID
            asset_id: t.assetId,
            long_side: t.isLong,
            is_limit: t.isLimit,
            leverage_x: t.leverage,
            entry_x6: Number(t.openPrice),
            margin_usd6: Number(t.marginUsdc),
            sl_x6: Number(t.stopLoss),
            tp_x6: Number(t.takeProfit),
            lots: Number(t.lotSize),
            created_at: Number(t.openTimestamp),
            target_x6: Number(t.openPrice),
            state: t.state,
            closePriceX6: Number(t.closePrice),
            pnl_usd6: null as number | null
        };

        const assetInfo = assetSymbolMap[position.asset_id];
        const assetWs = assetMap[position.asset_id];
        
        const enriched = {
            ...position,
            assetSymbol: assetInfo ? assetInfo.symbol : `Asset #${position.asset_id}`,
            size: convertLotsToDisplay(position.lots, position.asset_id).toFixed(2),
            priceDecimals: assetInfo ? assetInfo.priceDecimals : 2,
            priceStep: assetInfo ? assetInfo.priceStep : 0.01,
            currentPrice: assetWs?.currentPrice ? assetWs.currentPrice.toFixed(assetInfo?.priceDecimals || 2) : '---',
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

  // --- ACTIONS ---
  
  const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
      const baseSymbol = assetSymbol.split('/')[0];
      return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
  };

  const handleClosePosition = async (position: any) => { 
    try {
       // Logic Standard (Non-Paymaster pour être sûr)
       const proof = await getMarketProof(position.asset_id); 
       await writeContractAsync({
           address: PAYMASTER_ADDRESS,
           abi: PAYMASTER_ABI,
           functionName: 'closePositionMarket',
           args: [BigInt(position.id), proof]
       });
       toast({ title: "Close Order Sent", description: "Transaction submitted." });
       setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
        await writeContractAsync({
            address: PAYMASTER_ADDRESS,
            abi: PAYMASTER_ABI,
            functionName: 'cancelOrder',
            args: [BigInt(id)]
        });
        toast({ title: "Cancel Order Sent", description: "Transaction submitted." });
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateStopsLogic = async ({ id, slPrice, tpPrice, isSLChanged, isTPChanged }: any) => { 
    const newSLx6 = slPrice ? BigInt(Math.round(Number(slPrice) * 1000000)) : 0n;
    const newTPx6 = tpPrice ? BigInt(Math.round(Number(tpPrice) * 1000000)) : 0n;
    if (isSLChanged) await updateStops(id, newSLx6, isTPChanged ? newTPx6 : null);
    setTimeout(() => fetchTrades(), 2000);
  };

  const isActionDisabled = paymasterLoading || isWritePending;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black font-['Source_Code_Pro',_monospace]">
        
        {/* Navigation Onglets (Scrollable) */}
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
                            onAction={handleClosePosition} 
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

        {/* Dialog Edit Stops */}
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
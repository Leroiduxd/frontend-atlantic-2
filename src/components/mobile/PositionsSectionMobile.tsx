"use client";

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions"; 
import { useTrading } from "@/hooks/useTrading"; 
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/usePaymaster"; 
import { EditStopsDialog } from "@/components/EditStopsDialog";
// --- HELPER PROOF (Identique) ---
const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch proof");
    const data = await response.json();
    return data.proof as Hash; 
};

// --- CARTE DE POSITION MOBILE ---
const PositionCardMobile = ({ position, onAction, onEdit, formatPrice, getDisplaySymbol, isActionDisabled }: any) => {
    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    
    const pnlClass = isPNLPositive ? 'text-green-500' : 'text-red-500';
    const sideClass = position.long_side ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10';
    
    return (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
            
            {/* Header: Symbol + Side + PnL */}
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

            {/* Grid Data */}
            <div className="grid grid-cols-2 gap-y-3 text-xs mb-4">
                <div>
                    <span className="text-slate-400 block mb-0.5">Entry</span>
                    <span className="font-mono dark:text-zinc-200">{formatPrice(position.entry_x6, position.asset_id)}</span>
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
                    <span className="font-mono text-red-500">{position.liq_x6 ? formatPrice(position.liq_x6, position.asset_id) : '0.00'}</span>
                </div>
            </div>

            {/* Actions */}
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
                    Close
                </Button>
            </div>
        </div>
    );
};

// --- CARTE D'ORDRE MOBILE ---
const OrderCardMobile = ({ order, onCancel, formatPrice, getDisplaySymbol, isActionDisabled }: any) => {
    return (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 mb-3 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-sm dark:text-white">{getDisplaySymbol(order.assetSymbol, order.asset_id)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.long_side ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                    LIMIT {order.long_side ? 'LONG' : 'SHORT'}
                </span>
            </div>
            
            <div className="flex justify-between text-xs mb-4">
                <div>
                    <span className="text-slate-400 block mb-0.5">Price</span>
                    <span className="font-mono dark:text-zinc-200">{formatPrice(order.target_x6, order.asset_id)}</span>
                </div>
                <div className="text-right">
                    <span className="text-slate-400 block mb-0.5">Amount</span>
                    <span className="font-mono dark:text-zinc-200">{order.size}</span>
                </div>
            </div>

            <Button 
                variant="secondary"
                size="sm" 
                onClick={() => onCancel(order.id)}
                disabled={isActionDisabled}
                className="w-full h-8 text-xs font-semibold"
            >
                Cancel Order
            </Button>
        </div>
    );
};

// --- COMPOSANT PRINCIPAL MOBILE ---
export const PositionsSectionMobile = () => {
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  const { positions, orders, closedPositions, refetch } = usePositions();
  const { cancelOrder, updateStops, closePosition } = useTrading(); 
  const { toast } = useToast();
  const { executeGaslessAction, isLoading: paymasterLoading } = usePaymaster();
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 

  // --- LOGIC IDENTIQUE AU DESKTOP (MAPPINGS) ---
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
    }, {} as { [id: number]: { symbol: string; baseSymbol: string; priceDecimals: number; priceStep: number } });
  }, [assetConfigs]);

  const assetMap = useMemo(() => {
    const allAssets = getAssetsByCategory(wsData).crypto.concat(getAssetsByCategory(wsData).forex, getAssetsByCategory(wsData).commodities);
    return allAssets.reduce((map, asset) => {
      const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
      map[asset.id] = { currentPrice: currentPrice ? parseFloat(currentPrice) : null, pair: asset.pair };
      return map;
    }, {} as { [id: number]: { currentPrice: number | null; pair: string } });
  }, [wsData]);

  const formatPrice = (valueX6: number, assetId: number): string => {
    const assetInfo = assetSymbolMap[assetId];
    if (!assetInfo || valueX6 === 0) return "0.00";
    const value = valueX6 / 1000000;
    return value.toFixed(assetInfo.priceDecimals);
  };
  
  const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
      const baseSymbol = assetSymbol.split('/')[0];
      return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
  };

  const calculatePNL = (position: any, currentPrice: number | null) => {
    if (currentPrice === null || position.entry_x6 === 0) return { pnl: null, roe: null };
    const entryPrice = position.entry_x6 / 1000000;
    const roe = ((currentPrice / entryPrice) - 1) * (position.long_side ? 1 : -1) * position.leverage_x * 100;
    const pnl = (position.margin_usd6 / 1000000) * (roe / 100);
    return { pnl, roe };
  };
  
  const enrichPosition = (position: any) => {
    const assetSymbolInfo = assetSymbolMap[position.asset_id];
    if (!assetSymbolInfo) return { ...position, currentPrice: 'N/A', calculatedPNL: null };
    
    const currentPriceFloat = assetMap[position.asset_id]?.currentPrice || null;
    const { pnl, roe } = calculatePNL(position, currentPriceFloat);
    
    return {
      ...position,
      assetSymbol: assetSymbolInfo.symbol, 
      currentPrice: currentPriceFloat ? currentPriceFloat.toFixed(assetSymbolInfo.priceDecimals) : 'Loading...',
      calculatedPNL: pnl,
      calculatedROE: roe,
      size: convertLotsToDisplay(position.lots, position.asset_id).toFixed(2),
      priceDecimals: assetSymbolInfo.priceDecimals, 
      priceStep: assetSymbolInfo.priceStep,
    };
  };

  const enrichedPositions = useMemo(() => positions.map(enrichPosition), [positions, assetMap, assetSymbolMap]);
  const enrichedOrders = useMemo(() => orders.map(enrichPosition), [orders, assetMap, assetSymbolMap]);

  // --- ACTIONS ---
  const handleClosePosition = async (position: any) => { 
    try {
      const assetId = Number(position.asset_id);
      await executeGaslessAction({ type: 'close', positionId: position.id, assetId });
      toast({ title: 'Close Order Sent', description: `Tx pending via Paymaster.` });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
      await executeGaslessAction({ type: 'cancel', orderId: id });
      toast({ title: 'Cancel Sent', description: `Tx pending via Paymaster.` });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" });
    }
  };

  const handleUpdateStopsLogic = async ({ id, slPrice, tpPrice, isSLChanged, isTPChanged }: any) => { 
    try {
      if (!isSLChanged && !isTPChanged) return;
      await executeGaslessAction({ type: 'update', id, slPrice: isSLChanged ? Number(slPrice!) : undefined, tpPrice: isTPChanged ? Number(tpPrice!) : undefined });
      toast({ title: 'Update Sent', description: `Tx pending.` });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black font-['Source_Code_Pro',_monospace]">
        
        {/* Navigation Onglets */}
        <div className="flex p-2 bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10">
            <button onClick={() => setActiveTab('positions')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'positions' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>Positions ({positions.length})</button>
            <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'orders' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>Orders ({orders.length})</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>History</button>
        </div>

        {/* Contenu Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 pb-20">
            {activeTab === 'positions' && (
                enrichedPositions.length > 0 ? (
                    enrichedPositions.map(pos => (
                        <PositionCardMobile 
                            key={pos.id} 
                            position={pos} 
                            onAction={handleClosePosition} 
                            onEdit={(p: any) => { setSelectedPosition(p); setEditDialogOpen(true); }}
                            formatPrice={formatPrice}
                            getDisplaySymbol={getDisplaySymbol}
                            isActionDisabled={paymasterLoading}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No open positions.</div>
                )
            )}

            {activeTab === 'orders' && (
                enrichedOrders.length > 0 ? (
                    enrichedOrders.map(ord => (
                        <OrderCardMobile 
                            key={ord.id} 
                            order={ord} 
                            onCancel={handleCancelOrder}
                            formatPrice={formatPrice}
                            getDisplaySymbol={getDisplaySymbol}
                            isActionDisabled={paymasterLoading}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">No pending orders.</div>
                )
            )}

            {activeTab === 'history' && (
                <div className="text-center py-10 text-slate-400 text-sm">History View (Coming Soon)</div>
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
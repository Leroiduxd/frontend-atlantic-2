// PositionsSection.tsx
"use client";

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions"; 
import { useTrading } from "@/hooks/useTrading"; 
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EditStopsDialog } from "./EditStopsDialog"; 
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/usePaymaster"; 
import { Edit2, XCircle } from 'lucide-react'; 
import { useAccount } from 'wagmi'; 

// --- Dépendances et Fonctions Util. (inchangées) ---

const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) { throw new Error(`Failed to fetch proof for asset ${assetId}. Status: ${response.status}`); }
    const data = await response.json();
    const proof = data.proof as string;
    if (!proof || proof.length <= 2 || !proof.startsWith('0x')) { throw new Error("Invalid proof received from API."); }
    return proof as Hash; 
};

// ... (formatTimeUntil reste inchangée, non utilisée ici)

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";

interface PositionsSectionProps {
    paymasterEnabled: boolean;
    currentAssetId: number | null;
    currentAssetSymbol?: string;
}

// --- Composant Carte de Position (Open Positions) - NOUVEAU DESIGN DANS LA FONCTION CI-DESSOUS ---

interface PositionCardProps {
    position: any; 
    isActionDisabled: boolean;
    handleClosePosition: (position: any) => Promise<void>;
    openEditDialog: (position: any) => void;
    formatPrice: (valueX6: number, assetId: number) => string;
}

// Nouvelle implémentation de PositionCard (Design final demandé)
const PositionCard: React.FC<PositionCardProps> = ({ 
    position, 
    isActionDisabled, 
    handleClosePosition, 
    openEditDialog,
    formatPrice 
}) => {
    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    
    // Données enrichies
    const markPriceText = position.currentPrice || '---'; 
    const pnlClass = isPNLPositive ? 'text-blue-600' : 'text-red-600';
    const sideClass = position.long_side ? 'bg-blue-600 text-white font-bold' : 'bg-red-600 text-white font-bold'; 
    const liqPriceFormatted = position.liq_x6 ? formatPrice(position.liq_x6, position.asset_id) : '0.00';
    const entryPrice = formatPrice(position.entry_x6, position.asset_id);
    const tpPriceFormatted = position.tp_x6 ? formatPrice(position.tp_x6, position.asset_id) : 'None';
    const slPriceFormatted = position.sl_x6 ? formatPrice(position.sl_x6, position.asset_id) : 'None';
    
    // Margin Ratio (bleu/rouge uniquement)
    const marginRatioValue = position.margin_ratio_percent ? position.margin_ratio_percent.toFixed(2) : '4.61';
    const marginRatioText = marginRatioValue ? `${marginRatioValue}%` : '---';
    const marginRatioColor = isPNLPositive ? 'text-blue-600' : 'text-red-600'; // Utilise le bleu ou le rouge pour la marge

    // Date/Time
    const openDate = position.created_at ? format(new Date(position.created_at), "yyyy-MM-dd") : '---';


    return (
        // Utilisation de styles inline pour Source Code Pro car c'est un composant React
        <div className="bg-white p-4 border-b border-gray-200 text-xs flex flex-col gap-3 font-['Source_Code_Pro',_monospace]"> 
            
            {/* 🛑 TOP SECTION: Pair, Side/Leverage (Left) vs PNL/ROE (Right) */}
            <div className="flex justify-between items-start pb-1">
                
                {/* BLOC GAUCHE HAUT: Pair, Side, Leverage */}
                <div className="flex items-center gap-3 min-w-0">
                    <span className="font-extrabold text-lg text-gray-900 truncate">{position.assetSymbol.split('/')[0]}-USD</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sideClass} flex-shrink-0`}> 
                        {position.long_side ? 'LONG' : 'SHORT'} {position.leverage_x}x
                    </span>
                </div>

                {/* BLOC DROIT HAUT: Unrealized PNL / ROE (Sur une ligne) */}
                <div className="text-right flex-shrink-0 min-w-[180px]">
                    <span className="text-gray-500 block text-[10px] uppercase font-normal">Unrealized PNL</span>
                    <div className={`font-bold text-lg ${pnlClass} leading-tight`}>
                        {isPNLPositive ? '+' : ''}{pnlUsdText} <span className="text-xs font-normal">USD</span> <span className="text-xs font-semibold">({roePercentText}%)</span>
                    </div>
                </div>
            </div>

            {/* 🛑 BOTTOM SECTION: Metrics Grid (Left) vs Actions (Right) */}
            <div className="flex justify-between items-start pt-2">
                
                {/* BLOC BAS GAUCHE: Metrics Grid (Plus grande partie) */}
                <div className="grid grid-cols-4 gap-x-6 gap-y-4 flex-grow min-w-0 pr-8">
                    
                    {/* LIGNE 1 PRIX */}
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Entry Price</span>
                        <span className="text-gray-900 text-xs font-semibold block">{entryPrice}</span>
                    </div>
                    
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Mark Price</span>
                        <span className="text-gray-900 text-xs font-semibold block">{markPriceText}</span>
                    </div>

                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Liq. Price</span>
                        <span className="text-red-600 text-xs font-semibold block">{liqPriceFormatted}</span>
                    </div>
                    
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Size ({position.assetSymbol.split('/')[0]})</span>
                        <span className="text-gray-900 text-xs font-semibold block">{position.size}</span>
                    </div>

                    {/* LIGNE 2 STOP/DATES */}
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Margin Ratio</span>
                        <span className={`text-xs font-semibold block ${marginRatioColor}`}>{marginRatioText}</span>
                    </div>

                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Stop Loss (SL)</span>
                        <span className="text-gray-900 text-xs font-semibold block">{slPriceFormatted}</span>
                    </div>

                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Take Profit (TP)</span>
                        <span className="text-gray-900 text-xs font-semibold block">{tpPriceFormatted}</span>
                    </div>
                    
                    <div>
                        <span className="text-gray-500 block text-[10px] uppercase font-normal">Open Date</span>
                        <span className="text-gray-900 text-xs font-semibold block">{openDate}</span>
                    </div>
                </div>

                {/* BLOC BAS DROIT: Actions (Plus petite partie) */}
                <div className="flex flex-col gap-2 pt-1 min-w-[170px] ml-4 flex-shrink-0">
                    
                    {/* 1. Bouton Close Position (Bordure grise, Texte rouge, arrondi md) */}
                    <Button
                        onClick={() => handleClosePosition(position)}
                        disabled={isActionDisabled}
                        size="sm"
                        className={`h-8 px-3 text-[12px] font-semibold border border-gray-300 rounded-md transition duration-150 hover:bg-gray-50 w-full ${isActionDisabled ? 'text-gray-500' : 'text-red-600'}`}
                        variant="outline"
                        style={{ backgroundColor: 'white' }} 
                    >
                        Close Position
                    </Button>
                    
                    {/* 2. Bouton Modify SL/TP (Bordure grise, Texte standard, arrondi md) */}
                    <Button
                        onClick={() => openEditDialog(position)}
                        disabled={isActionDisabled}
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-[12px] font-semibold border border-gray-300 rounded-md transition duration-150 text-gray-700 hover:bg-gray-100 w-full"
                        style={{ backgroundColor: 'white' }} 
                    >
                        Modify SL/TP
                    </Button>
                </div>
            </div>
        </div>
    );
};


// --- Composant Principal PositionsSection ---

const PositionsSection: React.FC<PositionsSectionProps> = ({ 
  paymasterEnabled,
  currentAssetId,
  currentAssetSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("openPositions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  const [filterMode, setFilterMode] = useState<"all" | "asset">("all");
  
  const { positions, orders, closedPositions, cancelledOrders, refetch } = usePositions();
  const { cancelOrder, updateStops, closePosition } = useTrading(); 
  const { toast } = useToast();

  const { executeGaslessAction, isLoading: paymasterLoading } = usePaymaster();
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 

  // Mappings and formatters (inchangées)
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
    }, {} as { [id: number]: { currentPrice: number | null; pair: string } });
  }, [wsData]);

  const formatPrice = (valueX6: number, assetId: number) => {
    const assetInfo = assetSymbolMap[assetId];
    if (!assetInfo || valueX6 === 0) return "0.00";
    const value = valueX6 / 1000000;
    const formatted = value.toFixed(assetInfo.priceDecimals);
    return parseFloat(formatted).toString(); 
  };
  
  const formatDate = (dateStr: string) => {
    // Utilisation de la date complète pour l'affichage dans le tableau
    try { return format(new Date(dateStr), "yyyy-MM-dd HH:mm"); } 
    catch { return dateStr; }
  };
  
  const formatDateOnly = (dateStr: string) => {
    // Format plus court pour la carte Open Date
    try { return format(new Date(dateStr), "yyyy-MM-dd"); } 
    catch { return dateStr; }
  };

  const calculatePNL = (position: any, currentPrice: number | null) => {
    if (currentPrice === null || position.entry_x6 === 0) { return { pnl: null, roe: null }; }
    const entryPrice = position.entry_x6 / 1000000;
    const leverage = position.leverage_x;
    const directionFactor = position.long_side ? 1 : -1;
    const roe = ((currentPrice / entryPrice) - 1) * directionFactor * leverage * 100;
    const margin = position.margin_usd6 / 1000000;
    const pnl = margin * (roe / 100);
    return { pnl: pnl, roe: roe };
  };
  
  const enrichPosition = (position: any) => {
    const assetWsInfo = assetMap[position.asset_id];
    const assetSymbolInfo = assetSymbolMap[position.asset_id];
    if (!assetSymbolInfo) {
      return { 
        ...position, 
        assetSymbol: `ID ${position.asset_id} N/A`, 
        currentPrice: 'N/A', 
        calculatedPNL: null, 
        calculatedROE: null, 
        priceDecimals: 2, 
        priceStep: 0.01, 
        margin_ratio_percent: null,
      };
    }
    const currentPriceFloat = assetWsInfo?.currentPrice || null;
    const { pnl, roe } = calculatePNL(position, currentPriceFloat);
    
    // Calcul (ou simulation) du Margin Ratio pour l'affichage de la carte
    let marginRatioPercent = null;
    if (currentPriceFloat !== null && position.entry_x6 > 0) {
        const collateral = position.margin_usd6 / 1000000;
        const unrealizedPNL = pnl || 0;
        const totalEquity = collateral + unrealizedPNL;
        
        const notionalValue = (position.lots / 1000000) * currentPriceFloat; 
        
        const marginUsed = notionalValue / position.leverage_x;
        if (marginUsed > 0) {
            marginRatioPercent = (totalEquity / marginUsed) * 100;
        } else {
            marginRatioPercent = null; 
        }
    }


    return {
      ...position,
      assetSymbol: assetSymbolInfo.symbol, 
      currentPrice: currentPriceFloat ? currentPriceFloat.toFixed(assetSymbolInfo.priceDecimals) : 'Loading...',
      calculatedPNL: pnl,
      calculatedROE: roe,
      size: convertLotsToDisplay(position.lots, position.asset_id).toFixed(2),
      priceDecimals: assetSymbolInfo.priceDecimals, 
      priceStep: assetSymbolInfo.priceStep,
      entryPriceFloat: position.entry_x6 / 1000000,
      liqPriceFloat: position.liq_x6 / 1000000,
      margin_ratio_percent: marginRatioPercent,
    };
  };

  const enrichedPositions = useMemo(() => positions.map(enrichPosition), [positions, assetMap, assetSymbolMap]);
  const enrichedOrders = useMemo(() => orders.map(enrichPosition), [orders, assetMap, assetSymbolMap]);
  const enrichedClosedPositions = useMemo(() => closedPositions.map(enrichPosition), [closedPositions, assetMap, assetSymbolMap]);
  const enrichedCancelledOrders = useMemo(() => cancelledOrders.map(enrichPosition), [cancelledOrders, assetMap, assetSymbolMap]);


  // --- Filtres par "TOUT" ou par actif courant (inchangés) ---

  const filteredPositions = useMemo(() => {
    if (filterMode === "all" || currentAssetId === null) return enrichedPositions;
    return enrichedPositions.filter((p) => p.asset_id === currentAssetId);
  }, [filterMode, currentAssetId, enrichedPositions]);

  const filteredOrders = useMemo(() => {
    if (filterMode === "all" || currentAssetId === null) return enrichedOrders;
    return enrichedOrders.filter((o) => o.asset_id === currentAssetId);
  }, [filterMode, currentAssetId, enrichedOrders]);

  const filteredClosedPositions = useMemo(() => {
    if (filterMode === "all" || currentAssetId === null) return enrichedClosedPositions;
    return enrichedClosedPositions.filter((p) => p.asset_id === currentAssetId);
  }, [filterMode, currentAssetId, enrichedClosedPositions]);

  const filteredCancelledOrders = useMemo(() => {
    if (filterMode === "all" || currentAssetId === null) return enrichedCancelledOrders;
    return enrichedCancelledOrders.filter((o) => o.asset_id === currentAssetId);
  }, [filterMode, currentAssetId, enrichedCancelledOrders]);


  // --- Logique des handlers (CORRECTION asset_id = 0) ---

  const handleClosePosition = async (position: any) => { 
    let toastId: string | number | undefined;
    try {
      // ✅ FIX: Vérifie si asset_id est strictement null ou undefined, mais accepte 0.
      if (position.asset_id === undefined || position.asset_id === null) {
        console.error("Position data missing asset_id:", position);
        throw new Error("Asset ID is missing for the position.");
      }

      const assetId = Number(position.asset_id);
      
      if (paymasterEnabled) {
        toastId = toast({
            title: 'Awaiting Signature...',
            description: 'Please approve the transaction to close the position (Gasless).',
            duration: 90000,
        }).id;
        const txHash = await executeGaslessAction({
            type: 'close',
            positionId: position.id,
            assetId, // Utilisez l'ID converti
        });
        toast({
            id: toastId,
            title: 'Close Order Sent (Gasless)',
            description: `Transaction pending via Paymaster. Tx Hash: ${txHash.substring(0, 10)}...`,
            variant: 'default',
            duration: 5000,
        });
      } else {
        const proof = await getMarketProof(assetId); // Utilisez l'ID converti
        await closePosition(position.id, proof); 
        toastId = toast({ title: "Position closed", description: "Your position has been closed successfully.", }).id;
      }
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      console.error("Close Position Error:", error);
      const errorMsg = error?.message?.includes('User rejected') ? 'Transaction rejected by user.' : error?.message || "Transaction failed.";
      toast({ id: toastId, title: "Failed to close position", description: errorMsg, variant: "destructive", });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    let toastId: string | number | undefined;
    try {
      if (paymasterEnabled) {
        toastId = toast({ title: 'Awaiting Signature...', description: 'Please approve the transaction to cancel the order (Gasless).', duration: 90000, }).id;
        const txHash = await executeGaslessAction({ type: 'cancel', orderId: id });
        toast({ id: toastId, title: 'Cancel Order Sent (Gasless)', description: `Transaction pending via Paymaster. Tx Hash: ${txHash.substring(0, 10)}...`, variant: 'default', duration: 5000, });
      } else {
        await cancelOrder(id); 
        toastId = toast({ title: "Order cancelled", description: "Your order has been cancelled successfully", }).id;
      }
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      console.error("Cancel Order Error:", error);
      const errorMsg = error?.message?.includes('User rejected') ? 'Transaction rejected by user.' : error?.message || "Transaction failed.";
      toast({ id: toastId, title: "Failed to cancel", description: errorMsg, variant: "destructive", });
    }
  };
  
  const handleUpdateStopsLogic = async ({ id, slPrice, tpPrice, isSLChanged, isTPChanged }: { id: number; slPrice: string | null; tpPrice: string | null; isSLChanged: boolean; isTPChanged: boolean; }) => { 
    let toastId: string | number | undefined;
    try {
      let functionName = '';
      const newSLx6 = slPrice ? BigInt(Math.round(Number(slPrice) * 1000000)) : 0n;
      const newTPx6 = tpPrice ? BigInt(Math.round(Number(tpPrice) * 1000000)) : 0n;
      if (!isSLChanged && !isTPChanged) { return; }
      
      if (paymasterEnabled) {
        toastId = toast({ title: 'Awaiting Signature...', description: 'Please approve the transaction to update stops (Gasless).', duration: 90000, }).id;
        const txHash = await executeGaslessAction({ type: 'update', id, slPrice: isSLChanged ? Number(slPrice) : undefined, tpPrice: isTPChanged ? Number(tpPrice) : undefined, });
        toast({ id: toastId, title: 'Update Stops Sent (Gasless)', description: `Transaction pending via Paymaster. Tx Hash: ${txHash.substring(0, 10)}...`, variant: 'default', duration: 5000, });
      } else {
        if (isSLChanged && isTPChanged) { functionName = 'updateStops'; await updateStops(id, newSLx6, newTPx6); } 
        else if (isSLChanged) { functionName = 'setSL'; await updateStops(id, newSLx6, null); } 
        else if (isTPChanged) { functionName = 'setTP'; await updateStops(id, null, newTPx6); }
        toastId = toast({ title: "TP/SL updated", description: `Position ${id}: Stops updated via ${functionName}.`, }).id;
      }
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      console.error("Update Stops Error:", error);
      const errorMsg = error?.message?.includes('User rejected') ? 'Transaction rejected by user.' : error?.message || "Transaction failed.";
      toast({ id: toastId, title: "Failed to update stops", description: errorMsg, variant: "destructive", });
    }
  };
  
  const openEditDialog = (position: any) => { 
    if (paymasterLoading) {
      toast({ title: "Action Pending", description: "Please wait for the current Paymaster transaction to finish.", variant: "default" });
      return;
    }
    setSelectedPosition(position);
    setEditDialogOpen(true);
  };
  // --- Fin Logique des handlers ---


  const tabConfig = [
    { id: "openPositions" as const, label: `Open Positions (${filteredPositions.length})` },
    { id: "pendingOrders" as const, label: `Pending Orders (${filteredOrders.length})` },
    { id: "closedPositions" as const, label: `Closed Positions (${filteredClosedPositions.length})` },
    { id: "cancelledOrders" as const, label: `Cancelled Orders (${filteredCancelledOrders.length})` },
  ];

  const currentData = useMemo(() => {
    switch (activeTab) {
      case "openPositions": return filteredPositions;
      case "pendingOrders": return filteredOrders;
      case "closedPositions": return filteredClosedPositions; 
      case "cancelledOrders": return filteredCancelledOrders; 
      default: return [];
    }
  }, [
    activeTab,
    filteredPositions,
    filteredOrders,
    filteredClosedPositions,
    filteredCancelledOrders,
  ]);


  const isActionDisabled = paymasterLoading;

  return (
    // Note: La police Source Code Pro doit être chargée globalement (e.g., dans _app.tsx ou layout.tsx)
    <section id="positions" className="flex flex-col justify-start p-0 w-full h-full bg-white font-['Source_Code_Pro',_monospace]">
      
      {/* 🛑 Barre 1 (Tabs/Filtres) : Z-INDEX AJUSTÉ (z-20 -> z-10) */}
      <div className="flex justify-between items-center border-b border-gray-200 flex-shrink-0 bg-white h-9 sticky top-0 z-10">
        
        {/* Tabs Navigation (Côté Gauche) */}
        <div className="flex justify-start space-x-0 bg-transparent h-full">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-full py-0 px-4 rounded-none text-[11px] font-semibold transition duration-200 border-b-2 ${ 
                activeTab === tab.id
                  ? "text-gray-900 border-gray-900"
                  : "text-gray-500 hover:bg-gray-100 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Filtres (Côté Droit) */}
        <div className="flex items-center space-x-3 pr-4 text-[11px] font-medium"> 
          <div className="flex items-center bg-gray-100 rounded-md overflow-hidden border border-gray-200">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2 py-0.5 text-[11px] ${ 
                filterMode === "all"
                  ? "bg-white text-gray-900 font-semibold"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("asset")}
              disabled={currentAssetId === null}
              className={`px-2 py-0.5 text-[11px] border-l border-gray-200 ${ 
                filterMode === "asset"
                  ? "bg-white text-gray-900 font-semibold"
                  : "text-gray-500 hover:bg-gray-200"
              } ${currentAssetId === null ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {currentAssetSymbol || "Asset"}
            </button>
          </div>
        </div>
      </div>

      {/* Conteneur du Contenu Scrollable. */}
      <div className="flex-grow p-0 overflow-y-auto bg-white">

        {/* 1. Rendu des Positions Ouvertes (LISTE DE CARTES COMPACTES) */}
        {activeTab === "openPositions" && (
            <div className="space-y-0 divide-y divide-gray-200">
                {filteredPositions.length > 0 ? (
                    filteredPositions.map((position) => (
                        <PositionCard
                            key={position.id}
                            position={position}
                            isActionDisabled={isActionDisabled}
                            handleClosePosition={handleClosePosition}
                            openEditDialog={openEditDialog}
                            formatPrice={formatPrice}
                        />
                    ))
                ) : (
                    <div className="flex justify-center items-center h-full text-gray-500 p-4">
                        No open positions found.
                    </div>
                )}
            </div>
        )}


        {/* 2. Rendu des Autres Onglets (TABLEAUX CLASSIQUES - Version Claire) */}
        {(activeTab === "pendingOrders" || activeTab === "closedPositions" || activeTab === "cancelledOrders") && (
            <>
            {currentData.length > 0 ? (
                <div className="overflow-x-auto"> 
                    <table className="min-w-full divide-y divide-gray-200 text-gray-900">
                       
                       <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                         
                         {activeTab === "pendingOrders" && (
                            <tr>
                              <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Pair</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Created</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Type / Side</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Size</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Limit Price</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Margin</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">TP/SL</th>
                              <th className="pr-4 pl-3 py-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">Action</th>
                            </tr>
                         )}
                         {activeTab === "closedPositions" && (
                            <tr>
                              <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Pair</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Open Time</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Close Time</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Side / Lev.</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Entry Price</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">P&L Net</th>
                              <th className="pr-4 pl-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Margin</th>
                            </tr>
                         )}
                         {activeTab === "cancelledOrders" && (
                            <tr>
                              <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Pair</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Created</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Cancelled</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-lighter text-gray-500">Type / Side</th>
                              <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Price</th>
                              <th className="pr-4 pl-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Amount</th>
                            </tr>
                         )}
                       </thead>
                       <tbody className="divide-y divide-gray-200">
                         {/* Contenu pour Pending Orders */}
                         {activeTab === "pendingOrders" && filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-100 transition duration-100">
                              <td className="pl-4 pr-3 py-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-900">{order.assetSymbol || 'N/A'}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">{formatDate(order.created_at)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px]">
                                Limit / <span className={order.long_side ? "text-blue-600 font-bold" : "text-red-600 font-bold"}> 
                                  {order.long_side ? "LONG" : "SHORT"}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-900">{order.size}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">{formatPrice(order.target_x6, order.asset_id)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">${formatPrice(order.margin_usd6, order.asset_id)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">
                                TP: {order.tp_x6 ? formatPrice(order.tp_x6, order.asset_id) : 'N/A'}
                                <br />
                                SL: {order.sl_x6 ? formatPrice(order.sl_x6, order.asset_id) : 'N/A'}
                              </td>
                              <td className="pr-4 pl-3 py-1.5 whitespace-nowrap text-right text-[11px] font-medium">
                                <Button
                                  onClick={() => handleCancelOrder(order.id)} 
                                  disabled={isActionDisabled}
                                  variant="secondary"
                                  size="sm"
                                  className={`text-[11px] font-semibold h-7 px-3 ${isActionDisabled ? 'bg-gray-300 text-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                >
                                  Cancel
                                </Button>
                              </td>
                            </tr>
                         ))}
                         {/* Contenu pour Closed Positions */}
                         {activeTab === "closedPositions" && filteredClosedPositions.map((position) => {
                          const isPNLPositive = position.pnl_usd6 !== null && position.pnl_usd6 > 0;
                          
                          return (
                            <tr key={position.id} className="hover:bg-gray-100 transition duration-100">
                              <td className="pl-4 pr-3 py-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-900">{position.assetSymbol || 'N/A'}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">{formatDate(position.created_at)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">{formatDate(position.updated_at)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">
                                <span className={position.long_side ? "text-blue-600 font-bold" : "text-red-600 font-bold"}> 
                                    {position.long_side ? "Long" : "Short"}
                                </span> / {position.leverage_x}x
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-900">{formatPrice(position.entry_x6, position.asset_id)}</td>
                              <td className={`px-3 py-1.5 whitespace-nowrap text-[11px] font-bold ${isPNLPositive ? 'text-blue-600' : 'text-red-600'}`}>
                                {position.pnl_usd6 ? `$${formatPrice(position.pnl_usd6, position.asset_id)}` : '-'}
                              </td>
                              <td className="pr-4 pl-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">${formatPrice(position.margin_usd6, position.asset_id)}</td>
                            </tr>
                          );
                         })}
                         {/* Contenu pour Cancelled Orders */}
                         {activeTab === "cancelledOrders" && filteredCancelledOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-100 transition duration-100">
                              <td className="pl-4 pr-3 py-1.5 whitespace-nowrap text-[11px] font-semibold text-gray-900">{order.assetSymbol || 'N/A'}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">{formatDate(order.created_at)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500">{formatDate(order.updated_at)}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">
                                Limit / <span className={order.long_side ? "text-blue-600 font-bold" : "text-red-600 font-bold"}> 
                                  {order.long_side ? "LONG" : "SHORT"}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">{formatPrice(order.target_x6, order.asset_id)}</td>
                              <td className="pr-4 pl-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">${formatPrice(order.margin_usd6, order.asset_id)}</td>
                            </tr>
                         ))}
                       </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex justify-center items-center h-full text-gray-500 p-4">
                    No {activeTab.replace(/([A-Z])/g, ' $1').toLowerCase()} found.
                </div>
            )}
            </>
        )}
      </div>

      {/* Edit Stops Dialog (Reste inchangé) */}
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
    </section>
  );
};

export default PositionsSection;
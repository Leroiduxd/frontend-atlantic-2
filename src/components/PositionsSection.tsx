import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { usePositions } from "@/hooks/usePositions";
import { useTrading } from "@/hooks/useTrading";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EditStopsDialog } from "./EditStopsDialog";
import { useWebSocket, getAssetsByCategory, WebSocketMessage } from "@/hooks/useWebSocket";
// Import du hook pour la configuration des actifs
import { useAssetConfig } from "@/hooks/useAssetConfig"; 

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";

const PositionsSection = () => {
  const [activeTab, setActiveTab] = useState<TabType>("openPositions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const { positions, orders, closedPositions, cancelledOrders, refetch } = usePositions();
  const { cancelOrder, updateStops, closePosition } = useTrading(); 
  const { toast } = useToast();
  
  // 1. RÉCUPÉRATION DES DONNÉES WS ET CONFIG
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 

  // Carte pour lier Asset ID aux symboles et décimales du trading
  const assetSymbolMap = useMemo(() => {
    return assetConfigs.reduce((map, config) => {
        // Déterminer le nombre de décimales basé sur tick_size_usd6 (10^6 / tickSizeX6)
        const powerOfTen = Math.round(Math.log10(1000000 / config.tick_size_usd6)); 
        const decimals = Math.max(0, powerOfTen);

        map[config.asset_id] = { 
            symbol: `${config.symbol}/USD`, // Affichage conventionnel
            baseSymbol: config.symbol,     // Le symbole de base (BTC, ETH, etc.)
            priceDecimals: decimals,
        };
        return map;
    }, {} as { [id: number]: { symbol: string; baseSymbol: string; priceDecimals: number } });
  }, [assetConfigs]);


  // Carte pour lier Asset ID à la paire et au prix actuel du WS
  const assetMap = useMemo(() => {
    const allAssets = getAssetsByCategory(wsData).crypto.concat(
        getAssetsByCategory(wsData).forex,
        getAssetsByCategory(wsData).commodities,
        getAssetsByCategory(wsData).stocks,
        getAssetsByCategory(wsData).indices
    );
    return allAssets.reduce((map, asset) => {
      const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
      map[asset.id] = { 
        currentPrice: currentPrice ? parseFloat(currentPrice) : null,
        pair: asset.pair,
      };
      return map;
    }, {} as { [id: number]: { currentPrice: number | null; pair: string } });
  }, [wsData]);


  // Fonctions d'aide
  // 🛑 formatPrice utilise maintenant les décimales dynamiques
  const formatPrice = (valueX6: number, assetId: number) => {
    const assetInfo = assetSymbolMap[assetId];
    if (!assetInfo || valueX6 === 0) return "0.00";
    
    const value = valueX6 / 1000000;
    return value.toFixed(assetInfo.priceDecimals);
  };
  
  // Fonction pour formater le Size (inchangée)
  const formatLotSize = (lots: number, assetId: number) => {
    const size = convertLotsToDisplay(lots, assetId);
    return size.toFixed(2); 
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
    } catch {
      return dateStr;
    }
  };

  /**
   * Calcule le P&L en USD et le ROE.
   */
  const calculatePNL = (position: any, currentPrice: number | null) => {
    if (currentPrice === null || position.entry_x6 === 0) {
      return { pnl: null, roe: null };
    }
    
    const entryPrice = position.entry_x6 / 1000000;
    const leverage = position.leverage_x;
    const directionFactor = position.long_side ? 1 : -1;
    
    const roe = ((currentPrice / entryPrice) - 1) * directionFactor * leverage * 100;
    const margin = position.margin_usd6 / 1000000;
    const pnl = margin * (roe / 100);

    return { pnl: pnl, roe: roe };
  };
  
  // Fonction pour ajouter le prix actuel, le P&L et la taille de position
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
      };
    }
    
    const currentPriceFloat = assetWsInfo?.currentPrice || null;
    const { pnl, roe } = calculatePNL(position, currentPriceFloat);

    return {
      ...position,
      // 🛑 Utilisation du symbole réel
      assetSymbol: assetSymbolInfo.symbol, 
      // Formatage du prix courant pour affichage
      currentPrice: currentPriceFloat ? currentPriceFloat.toFixed(assetSymbolInfo.priceDecimals) : 'Loading...',
      marketPriceValue: currentPriceFloat, 
      calculatedPNL: pnl,
      calculatedROE: roe,
      size: formatLotSize(position.lots, position.asset_id),
      priceDecimals: assetSymbolInfo.priceDecimals, // Pour les helpers
    };
  };

  // Ajout des données en temps réel aux positions ouvertes
  const enrichedPositions = useMemo(() => positions.map(enrichPosition), [positions, assetMap, assetSymbolMap]);
  const enrichedOrders = useMemo(() => orders.map(enrichPosition), [orders, assetMap, assetSymbolMap]);
  const enrichedClosedPositions = useMemo(() => closedPositions.map(enrichPosition), [closedPositions, assetMap]);
  const enrichedCancelledOrders = useMemo(() => cancelledOrders.map(enrichPosition), [cancelledOrders, assetMap]);


  // --- Logique des handlers (inchangée) ---
  const handleCancelOrder = async (id: number) => { 
    try {
      await cancelOrder(id); 
      toast({
        title: "Order cancelled",
        description: "Your order has been cancelled successfully",
      });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({
        title: "Failed to cancel",
        description: error?.message || "Transaction failed",
        variant: "destructive",
      });
    }
  };
  
  const handleClosePosition = async (id: number) => { 
    try {
      await closePosition(id); 
      toast({
        title: "Position closed",
        description: "Your position has been closed successfully",
      });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({
        title: "Failed to close",
        description: error?.message || "Transaction failed",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStops = async (id: number, slPrice: string, tpPrice: string) => { 
    try {
      const slX6 = slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
      const tpX6 = tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;
      await updateStops(id, slX6, tpX6);
      toast({
        title: "TP/SL updated",
        description: "Your stop loss and take profit have been updated",
      });
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error?.message || "Transaction failed",
        variant: "destructive",
      });
    }
  };
  const openEditDialog = (position: any) => { 
    setSelectedPosition(position);
    setEditDialogOpen(true);
  };
  // --- Fin Logique des handlers ---


  const tabConfig = [
    { id: "openPositions" as const, label: `Open Positions (${enrichedPositions.length})` },
    { id: "pendingOrders" as const, label: `Pending Orders (${enrichedOrders.length})` },
    { id: "closedPositions" as const, label: `Closed Positions (${enrichedClosedPositions.length})` },
    { id: "cancelledOrders" as const, label: `Cancelled Orders (${enrichedCancelledOrders.length})` },
  ];

  return (
    <section id="positions" className="snap-section flex flex-col justify-start p-0 h-screen w-full">
      {/* Tabs Navigation (inchangée) */}
      <div className="flex justify-start space-x-0 border-b border-border flex-shrink-0 bg-background">
        <div className="flex space-x-2 pl-0 pb-0 bg-transparent">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 rounded-none text-xs font-semibold transition duration-200 border-b-2 ${
                activeTab === tab.id
                  ? "bg-active-tab text-foreground border-foreground"
                  : "text-muted-foreground hover:bg-hover-bg border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-grow p-0 overflow-hidden bg-background">

        {/* Open Positions */}
        {activeTab === "openPositions" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Open Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Side / Lev.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Size
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Margin
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Entry Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Current Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Liq. Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    P&L (ROE)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    TP/SL
                  </th>
                  <th className="pr-4 pl-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-light-text">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedPositions.map((position) => {
                  const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
                  const pnlText = position.calculatedPNL !== null 
                    ? `$${position.calculatedPNL.toFixed(2)} (${position.calculatedROE?.toFixed(2)}%)`
                    : 'Calculating...';
                    
                  return (
                    <tr key={position.id} className="hover:bg-hover-bg transition duration-100">
                      <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {/* 🛑 Symbole dynamique */}
                        {position.assetSymbol || 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        {formatDate(position.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <span className={position.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                          {position.long_side ? "LONG" : "SHORT"}
                        </span> / {position.leverage_x}x
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {position.size}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        ${formatPrice(position.margin_usd6, position.asset_id)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {/* 🛑 Formatage dynamique du prix d'entrée */}
                        {formatPrice(position.entry_x6, position.asset_id)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {position.currentPrice}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        {position.liq_x6 ? formatPrice(position.liq_x6, position.asset_id) : 'N/A'}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold ${isPNLPositive ? 'text-trading-blue' : 'text-trading-red'}`}>
                        {pnlText}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        TP: {position.tp_x6 ? formatPrice(position.tp_x6, position.asset_id) : 'N/A'}
                        <br />
                        SL: {position.sl_x6 ? formatPrice(position.sl_x6, position.asset_id) : 'N/A'}
                      </td>
                      <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button 
                          onClick={() => openEditDialog(position)}
                          className="text-trading-blue hover:text-trading-blue/80 text-xs"
                        >
                          Edit TP/SL
                        </button>
                        <Button
                          onClick={() => handleClosePosition(position.id)}
                          size="sm"
                          className="bg-trading-red/10 text-trading-red hover:bg-trading-red/20 text-xs font-semibold"
                        >
                          Close
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending Orders */}
        {activeTab === "pendingOrders" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Type / Side
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Size
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Market Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Limit Price
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Margin
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    TP/SL
                  </th>
                  <th className="pr-4 pl-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-light-text">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      {/* 🛑 Symbole dynamique */}
                      {order.assetSymbol || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      Limit / <span className={order.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                        {order.long_side ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                      {order.size}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                      {order.currentPrice}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {/* 🛑 Formatage dynamique du prix limite */}
                      {formatPrice(order.target_x6, order.asset_id)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6, order.asset_id)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      TP: {order.tp_x6 ? formatPrice(order.tp_x6, order.asset_id) : 'N/A'}
                      <br />
                      SL: {order.sl_x6 ? formatPrice(order.sl_x6, order.asset_id) : 'N/A'}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        onClick={() => handleCancelOrder(order.id)} 
                        variant="secondary"
                        size="sm"
                        className="text-xs font-semibold"
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Closed Positions */}
        {activeTab === "closedPositions" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Open Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Close Time
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Side / Lev.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    P&L Net
                  </th>
                  <th className="pr-4 pl-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedClosedPositions.map((position) => {
                  const isPNLPositive = position.pnl_usd6 !== null && position.pnl_usd6 > 0;
                  
                  return (
                    <tr key={position.id} className="hover:bg-hover-bg transition duration-100">
                      <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {/* 🛑 Symbole dynamique */}
                        {position.assetSymbol || 'N/A'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        {formatDate(position.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        {formatDate(position.updated_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        {position.long_side ? "Long" : "Short"} / {position.leverage_x}x
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold ${isPNLPositive ? 'text-trading-blue' : 'text-trading-red'}`}>
                        {position.pnl_usd6 ? `$${formatPrice(position.pnl_usd6, position.asset_id)}` : '-'}
                      </td>
                      <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                        ${formatPrice(position.margin_usd6, position.asset_id)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancelled Orders */}
        {activeTab === "cancelledOrders" && (
          <div className="h-full overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="pl-4 pr-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Pair
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Cancelled
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Type / Side
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Price
                  </th>
                  <th className="pr-4 pl-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-light-text">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrichedCancelledOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-hover-bg transition duration-100">
                    <td className="pl-4 pr-3 py-2 whitespace-nowrap text-sm font-semibold">
                      {/* 🛑 Symbole dynamique */}
                      {order.assetSymbol || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      {formatDate(order.updated_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      Limit / <span className={order.long_side ? "text-trading-blue font-bold" : "text-trading-red font-bold"}>
                        {order.long_side ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {formatPrice(order.target_x6, order.asset_id)}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6, order.asset_id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Stops Dialog (inchangé) */}
      {selectedPosition && (
        <EditStopsDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          positionId={selectedPosition.id}
          currentSL={selectedPosition.sl_x6}
          currentTP={selectedPosition.tp_x6}
          onConfirm={handleUpdateStops}
        />
      )}
    </section>
  );
};

export default PositionsSection;
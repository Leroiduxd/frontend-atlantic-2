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
  // Les fonctions closePosition et cancelOrder sont déjà importées depuis useTrading
  const { cancelOrder, updateStops, closePosition } = useTrading(); 
  const { toast } = useToast();
  
  // 1. RÉCUPÉRATION DES DONNÉES WS ET CONFIG
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 

  const allAssets = useMemo(() => getAssetsByCategory(wsData).crypto.concat(
    getAssetsByCategory(wsData).forex,
    getAssetsByCategory(wsData).commodities,
    getAssetsByCategory(wsData).stocks,
    getAssetsByCategory(wsData).indices
  ), [wsData]);

  // Carte pour lier Asset ID à la paire et au prix actuel
  const assetMap = useMemo(() => {
    return allAssets.reduce((map, asset) => {
      const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
      map[asset.id] = { 
        symbol: asset.symbol, 
        currentPrice: currentPrice ? parseFloat(currentPrice) : null,
        pair: asset.pair,
      };
      return map;
    }, {} as { [id: number]: { symbol: string; currentPrice: number | null; pair: string } });
  }, [allAssets, wsData]);


  // Fonctions d'aide
  const formatPrice = (value: number) => {
    return (value / 1000000).toFixed(2);
  };
  
  // Fonction pour formater le Size (lots * lot_num / lot_den)
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
    const assetInfo = assetMap[position.asset_id];
    
    if (!assetInfo) {
      return {
        ...position,
        assetSymbol: 'N/A',
        currentPrice: 'N/A',
        calculatedPNL: null,
        calculatedROE: null,
      };
    }
    
    const { pnl, roe } = calculatePNL(position, assetInfo.currentPrice);

    return {
      ...position,
      assetSymbol: assetInfo.symbol,
      currentPrice: assetInfo.currentPrice ? formatPrice(assetInfo.currentPrice * 1000000) : 'Loading...',
      marketPriceValue: assetInfo.currentPrice, // Valeur brute
      calculatedPNL: pnl,
      calculatedROE: roe,
      size: formatLotSize(position.lots, position.asset_id),
    };
  };

  // Ajout des données en temps réel aux positions ouvertes
  const enrichedPositions = useMemo(() => positions.map(enrichPosition), [positions, assetMap, assetConfigs]);
  const enrichedOrders = useMemo(() => orders.map(enrichPosition), [orders, assetMap, assetConfigs]);
  const enrichedClosedPositions = useMemo(() => closedPositions.map(enrichPosition), [closedPositions, assetMap]);
  const enrichedCancelledOrders = useMemo(() => cancelledOrders.map(enrichPosition), [cancelledOrders, assetMap]);


  // --- Logique des handlers ---
  
  // 🛑 HANDLER POUR ANNULER UN ORDRE (APPEL À cancel(id) SC)
  const handleCancelOrder = async (id: number) => { 
    try {
      // closePosition(id) est appelé par le hook useTrading avec l'ID de la position (uint32)
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
  
  // 🛑 HANDLER POUR FERMER UNE POSITION (APPEL À closeMarket(id) SC)
  const handleClosePosition = async (id: number) => { 
    try {
      // closePosition(id) est appelé par le hook useTrading avec l'ID de la position (uint32)
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
                        ${formatPrice(position.margin_usd6)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {formatPrice(position.entry_x6)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold">
                        {position.currentPrice}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        {position.liq_x6 ? formatPrice(position.liq_x6) : 'N/A'}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-sm font-bold ${isPNLPositive ? 'text-trading-blue' : 'text-trading-red'}`}>
                        {pnlText}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                        TP: {position.tp_x6 ? formatPrice(position.tp_x6) : 'N/A'}
                        <br />
                        SL: {position.sl_x6 ? formatPrice(position.sl_x6) : 'N/A'}
                      </td>
                      <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button 
                          onClick={() => openEditDialog(position)}
                          className="text-trading-blue hover:text-trading-blue/80 text-xs"
                        >
                          Edit TP/SL
                        </button>
                        <Button
                          // 🛑 Appel au handler pour fermer la position (closeMarket)
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
                      {formatPrice(order.target_x6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-light-text">
                      TP: {order.tp_x6 ? formatPrice(order.tp_x6) : 'N/A'}
                      <br />
                      SL: {order.sl_x6 ? formatPrice(order.sl_x6) : 'N/A'}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        // 🛑 Appel au handler pour annuler l'ordre (cancel)
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

        {/* Closed Positions (inchangé) */}
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
                        {position.pnl_usd6 ? `$${formatPrice(position.pnl_usd6)}` : '-'}
                      </td>
                      <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                        ${formatPrice(position.margin_usd6)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cancelled Orders (inchangé) */}
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
                      {formatPrice(order.target_x6)}
                    </td>
                    <td className="pr-4 pl-3 py-2 whitespace-nowrap text-sm">
                      ${formatPrice(order.margin_usd6)}
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
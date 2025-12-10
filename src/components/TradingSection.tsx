// TradingSection.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { ChartControls, Asset } from "./ChartControls";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";
import { useWebSocket } from "@/hooks/useWebSocket";
import PositionsSection from "./PositionsSection"; 

// --- Constantes de Hauteur ---
const MIN_HEIGHT = 36; // Hauteur minimale de la barre de titre de PositionsSection (h-9)

// ➡️ MODIFICATION: Utilisation de '30%' pour la hauteur déployée
const INITIAL_HEIGHT_PERCENTAGE = '37%'; 

const TradingSection = () => {
  const { data: wsData } = useWebSocket();
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 0, 
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "btc_usdt",
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState("300");

  // 👉 ÉTAT GLOBAL POUR LE PAYMASTER (ON/OFF)
  const [paymasterEnabled, setPaymasterEnabled] = useState(false);
  
  // 👉 ÉTAT POUR LA RÉDUCTION/DÉPLOIEMENT
  const [isPositionsCollapsed, setIsPositionsCollapsed] = useState(false);

  // ... (Logique de data fetching et de prix inchangée) ...
  const { data } = useChartData(selectedAsset.id, selectedTimeframe);
  const { positions } = usePositions();

  const currentWsPrice = useMemo(() => {
    if (!selectedAsset.pair || !wsData[selectedAsset.pair]) return null;
    
    const pairData = wsData[selectedAsset.pair];
    if (pairData.instruments && pairData.instruments.length > 0) {
      return parseFloat(pairData.instruments[0].currentPrice);
    }
    return null;
  }, [wsData, selectedAsset.pair]);

  const { priceChange, priceChangePercent, aggregatedCurrentPrice } = useMemo(() => {
    const currentPriceUsed =
      currentWsPrice ||
      (data.length > 0 ? parseFloat(data[data.length - 1].close) : 0);

    if (data.length < 2 || currentPriceUsed === 0) {
      return { priceChange: 0, priceChangePercent: 0, aggregatedCurrentPrice: currentPriceUsed };
    }

    const firstPrice = parseFloat(data[0].open);
    const change = currentPriceUsed - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    return {
      priceChange: change,
      priceChangePercent: changePercent,
      aggregatedCurrentPrice: currentPriceUsed,
    };
  }, [data, currentWsPrice]);
  
  const finalCurrentPrice = currentWsPrice || aggregatedCurrentPrice;

  // ➡️ MODIFICATION: Définition conditionnelle de la hauteur pour le rendu
  // Soit la hauteur minimale en pixels, soit le pourcentage
  const finalHeight = isPositionsCollapsed ? `${MIN_HEIGHT}px` : INITIAL_HEIGHT_PERCENTAGE; 

  // ----------------------------------------------------
  // 🔴 LOGIQUE DE GLISSEMENT (DRAGGING) RETIRÉE
  // ----------------------------------------------------

  return (
    <section id="trading" className="snap-section flex h-screen w-full">
      {/* 🧱 Colonne gauche : Controls + Chart + Positions */}
      <div 
        id="trading-column-left" 
        className="bg-chart-bg flex-grow h-full flex flex-col overflow-x-hidden"
      >
        
        {/* 1️⃣ Barre pair / prix / timeframes (Hauteur fixe : h-12) */}
        <div className="h-12 border-b border-border">
          <ChartControls
            selectedAsset={selectedAsset}
            onAssetChange={setSelectedAsset}
            selectedTimeframe={selectedTimeframe}
            onTimeframeChange={setSelectedTimeframe}
            priceChange={priceChange}
            priceChangePercent={priceChangePercent}
            currentPrice={aggregatedCurrentPrice}
          />
        </div>

        {/* 2️⃣ Graphique (Prend tout l'espace restant : flex-1) */}
        {/* Le fait que le graphique soit flex-1 garantit qu'il prend l'espace restant 
            après que la barre de contrôles (h-12) et la section des positions (hauteur dynamique)
            ont pris leur place dans le flex-col parent (h-full). */}
        <div className="flex-1 min-h-0">
          <LightweightChart 
            data={data} 
            positions={positions} 
            isPositionsCollapsed={isPositionsCollapsed} 
          />
        </div>
        
        {/* 3️⃣ Positions (Hauteur DYNAMIQUE contrôlée par finalHeight) */}
        <div 
          style={{ height: finalHeight }} // 👈 Utilise '30%' (déployé) ou '36px' (réduit)
          className="border-t border-border bg-white overflow-hidden transition-height duration-300 ease-in-out" 
        >
          <div className="w-full h-full">
            <PositionsSection 
              paymasterEnabled={paymasterEnabled}
              currentAssetId={selectedAsset.id}
              currentAssetSymbol={selectedAsset.symbol.split("/")[0]}
              // 👉 PROPS DE CONTRÔLE DE LA RÉDUCTION
              isCollapsed={isPositionsCollapsed}
              onToggleCollapse={() => {
                // La logique de bascule simple est rétablie
                setIsPositionsCollapsed(prev => !prev);
              }}
            />
          </div>
        </div>

      </div>

      {/* 🧱 Colonne droite : Order Panel */}
      <OrderPanel 
        selectedAsset={selectedAsset} 
        currentPrice={finalCurrentPrice}
        paymasterEnabled={paymasterEnabled}
        onTogglePaymaster={() => setPaymasterEnabled(prev => !prev)}
      />
    </section>
  );
};

export default TradingSection;
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
import { BottomBar } from "../components/BottomBar"; 
// import { HealthStatusPanel } from "../components/HealthStatusPanel"; // <-- CECI DOIT ÊTRE RETIRÉ

// --- Constantes de Hauteur ---
const MIN_HEIGHT = 36; 
const FOOTER_HEIGHT = 34; 

// ➡️ Hauteur déployée de la section Positions
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

  // Définition conditionnelle de la hauteur pour PositionsSection
  const finalPositionsHeight = isPositionsCollapsed ? `${MIN_HEIGHT}px` : INITIAL_HEIGHT_PERCENTAGE; 


  return (
    // Conteneur principal qui prend toute la hauteur de l'écran (h-screen)
    // et gère la disposition verticale des sections (Trading + BottomBar)
    <div className="h-screen w-full flex flex-col"> 
        
        {/* 1. Section Trading (Graphique + Order Panel) : Prend la hauteur restante (`flex-1`) */}
        <section 
            id="trading" 
            className="snap-section flex flex-1 w-full min-h-0" 
        >
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
                <div className="flex-1 min-h-0">
                    <LightweightChart 
                        data={data} 
                        positions={positions} 
                        isPositionsCollapsed={isPositionsCollapsed} 
                    />
                </div>
                
                {/* 3️⃣ Positions (Hauteur DYNAMIQUE contrôlée par finalPositionsHeight) */}
                <div 
                    style={{ height: finalPositionsHeight }} 
                    className="border-t border-border bg-white overflow-hidden transition-height duration-300 ease-in-out" 
                >
                    <div className="w-full h-full">
                        <PositionsSection 
                            paymasterEnabled={paymasterEnabled}
                            currentAssetId={selectedAsset.id}
                            currentAssetSymbol={selectedAsset.symbol.split("/")[0]}
                            isCollapsed={isPositionsCollapsed}
                            onToggleCollapse={() => {
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

        {/* 2. Pied de Page (BottomBar) : Hauteur fixe 34px */}
        <BottomBar 
            onAssetSelect={setSelectedAsset} 
            currentAssetId={selectedAsset.id} 
        />

        {/* NOUVEAU: Panneau de Statut Fixe - RETIRÉ */}
        {/* <HealthStatusPanel /> */} 

    </div>
  );
};

export default TradingSection;
"use client";

import { useState, useMemo } from "react";
import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { ChartControls, Asset } from "./ChartControls";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";
import { useWebSocket } from "@/hooks/useWebSocket";
import PositionsSection from "./PositionsSection"; 
import { BottomBar } from "../components/BottomBar"; 

// --- Constantes de Hauteur ---
const MIN_HEIGHT = 36; 
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

  const [paymasterEnabled, setPaymasterEnabled] = useState(false);
  const [isPositionsCollapsed, setIsPositionsCollapsed] = useState(false);

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
  const finalPositionsHeight = isPositionsCollapsed ? `${MIN_HEIGHT}px` : INITIAL_HEIGHT_PERCENTAGE; 

  return (
    <div className="h-screen w-full flex flex-col bg-white dark:bg-black transition-colors duration-300"> 
        
        <section id="trading" className="snap-section flex flex-1 w-full min-h-0">
            
            {/* 🧱 Colonne gauche : Controls + Chart + Positions */}
            <div id="trading-column-left" className="bg-white dark:bg-black flex-grow h-full flex flex-col overflow-x-hidden">
                
                {/* 1️⃣ Barre pair / prix (Haut) */}
                {/* MODIF: border-gray-200 (clair) -> dark:border-zinc-800 (sombre) */}
                <div className="h-12 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
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

                {/* 2️⃣ Graphique (Milieu) - FOND NOIR TOTAL */}
                <div className="flex-1 min-h-0 bg-white dark:bg-black relative z-0">
                    <LightweightChart 
                        data={data} 
                        positions={positions} 
                        isPositionsCollapsed={isPositionsCollapsed} 
                    />
                </div>
                
                {/* 3️⃣ Positions (Bas) */}
                {/* MODIF: border-t border-gray-200 -> dark:border-zinc-800 */}
                <div 
                    style={{ height: finalPositionsHeight }} 
                    className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-black overflow-hidden transition-height duration-300 ease-in-out flex-shrink-0 z-10" 
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

        {/* 2. Pied de Page (BottomBar) */}
        <BottomBar 
            onAssetSelect={setSelectedAsset} 
            currentAssetId={selectedAsset.id} 
        />

    </div>
  );
};

export default TradingSection;
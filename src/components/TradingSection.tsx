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
// ❌ J'AI ENLEVÉ LE USESTATE D'ICI

const TradingSection = () => {
  const { data: wsData } = useWebSocket();
  
  // ✅ 1. LE USESTATE DOIT ÊTRE ICI, DANS LE COMPOSANT
  const [showLpBanner, setShowLpBanner] = useState(true);

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
            
        <div id="trading-column-left" className="bg-white dark:bg-black flex-grow h-full flex flex-col overflow-x-hidden">
                
                {/* 1️⃣ Barre pair / prix (Haut) */}
                <div className="h-auto border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
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

                {/* 1.5️⃣ Bande Promo (Mise à jour) */}
                {showLpBanner && (
                    <div className="w-full bg-sky-100 dark:bg-sky-950 transition-colors text-sky-900 dark:text-sky-100 text-xs sm:text-sm py-2 px-4 flex items-center justify-between font-medium flex-shrink-0 z-10 shadow-sm border-b border-sky-200 dark:border-sky-800">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span>
                                <strong className="font-semibold">Mainnet is coming — Early LP access is now open.</strong>{" "}
                                <span className="hidden sm:inline opacity-90">Provide liquidity to the Brokex Vault.</span>
                            </span>
                            <a 
                                href="https://t.me/Moustafakhl" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-1.5 rounded-full transition-colors font-bold whitespace-nowrap shadow-sm"
                            >
                                Become LP
                            </a>
                        </div>
                        
                        {/* Bouton de fermeture (Croix) */}
                        <button 
                            onClick={() => setShowLpBanner(false)}
                            className="text-sky-900/50 hover:text-sky-900 dark:text-sky-100/50 dark:hover:text-sky-100 transition-colors ml-4 flex-shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}
    
                {/* 2️⃣ Graphique (Milieu) */}
                <div className="flex-1 min-h-0 bg-white dark:bg-black relative z-0">
                    <LightweightChart 
                        key={showLpBanner ? "banner-visible" : "banner-hidden"} // 🔥 L'astuce est ici
                        data={data} 
                        positions={positions} 
                        isPositionsCollapsed={isPositionsCollapsed} 
                    />
                </div>
                
                {/* 3️⃣ Positions (Bas) */}
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

        {/* Pied de Page (BottomBar) */}
        <BottomBar 
            onAssetSelect={setSelectedAsset} 
            currentAssetId={selectedAsset.id} 
        />

    </div>
  );
};

export default TradingSection;
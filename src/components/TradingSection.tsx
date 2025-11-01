import { useState, useMemo } from "react";
import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { ChartControls, Asset } from "./ChartControls";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";
import { useWebSocket } from "@/hooks/useWebSocket";

const TradingSection = () => {
  const { data: wsData } = useWebSocket();
  
  // 🛑 L'ID est initialisé à 0, mais sera mis à jour par ChartControls.
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 0, 
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "btc_usdt",
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState("300");

  const { data } = useChartData(selectedAsset.id, selectedTimeframe);
  const { positions } = usePositions();

  // 1. Get current price from WebSocket (Tick le plus récent)
  const currentWsPrice = useMemo(() => {
    if (!selectedAsset.pair || !wsData[selectedAsset.pair]) return null;
    
    const pairData = wsData[selectedAsset.pair];
    if (pairData.instruments && pairData.instruments.length > 0) {
      return parseFloat(pairData.instruments[0].currentPrice);
    }
    return null;
  }, [wsData, selectedAsset.pair]);

  // 2. Calculate price change (Basé sur les données historiques/agrégées)
  const { priceChange, priceChangePercent, aggregatedCurrentPrice } = useMemo(() => {
    const currentPriceUsed = currentWsPrice || 
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


  return (
    <section id="trading" className="snap-section flex h-screen w-full">
      {/* Chart Area (Full Bleed) */}
      <div className="bg-chart-bg flex-grow h-full relative">
        <LightweightChart data={data} positions={positions} />
        <ChartControls
          selectedAsset={selectedAsset}
          onAssetChange={setSelectedAsset} // 🛑 C'est ici que l'état de l'ID est mis à jour
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
          priceChange={priceChange}
          priceChangePercent={priceChangePercent}
          currentPrice={aggregatedCurrentPrice} 
        />
      </div>

      {/* Order Panel */}
      <OrderPanel 
        selectedAsset={selectedAsset} 
        currentPrice={finalCurrentPrice}
      />
    </section>
  );
};

export default TradingSection;
import { useState, useMemo } from "react";
import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { ChartControls, Asset } from "./ChartControls";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";
import { useWebSocket } from "@/hooks/useWebSocket";

const TradingSection = () => {
  const { data: wsData } = useWebSocket();
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 0,
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "btc_usdt",
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState("300");

  const { data } = useChartData(selectedAsset.id, selectedTimeframe);
  const { positions } = usePositions();

  // Get current price from WebSocket
  const currentWsPrice = useMemo(() => {
    if (!selectedAsset.pair || !wsData[selectedAsset.pair]) return null;
    const pairData = wsData[selectedAsset.pair];
    if (pairData.instruments && pairData.instruments.length > 0) {
      return parseFloat(pairData.instruments[0].currentPrice);
    }
    return null;
  }, [wsData, selectedAsset.pair]);

  // Calculate price change
  const { priceChange, priceChangePercent, currentPrice } = useMemo(() => {
    if (data.length < 2) {
      return { priceChange: 0, priceChangePercent: 0, currentPrice: 0 };
    }

    const firstPrice = parseFloat(data[0].open);
    const lastPrice = parseFloat(data[data.length - 1].close);
    const change = lastPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    return {
      priceChange: change,
      priceChangePercent: changePercent,
      currentPrice: lastPrice,
    };
  }, [data]);

  return (
    <section id="trading" className="snap-section flex h-screen w-full">
      {/* Chart Area (Full Bleed) */}
      <div className="bg-chart-bg flex-grow h-full relative">
        <LightweightChart data={data} positions={positions} />
        <ChartControls
          selectedAsset={selectedAsset}
          onAssetChange={setSelectedAsset}
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
          priceChange={priceChange}
          priceChangePercent={priceChangePercent}
          currentPrice={currentPrice}
        />
      </div>

      {/* Order Panel */}
      <OrderPanel 
        selectedAsset={selectedAsset} 
        currentPrice={currentWsPrice || currentPrice}
      />
    </section>
  );
};

export default TradingSection;

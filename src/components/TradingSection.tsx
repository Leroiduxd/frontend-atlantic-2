// TradingSection.tsx
import { useState, useMemo } from "react";
import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { ChartControls, Asset } from "./ChartControls";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";
import { useWebSocket } from "@/hooks/useWebSocket";
import PositionsSection from "./PositionsSection"; // 👈 on importe directement ici

const TradingSection = () => {
  const { data: wsData } = useWebSocket();
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 0, 
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "btc_usdt",
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState("300");

  // 👉 NOUVEAU : état global pour le Paymaster (ON/OFF)
  const [paymasterEnabled, setPaymasterEnabled] = useState(false);

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

  return (
    <section id="trading" className="snap-section flex h-screen w-full">
      {/* 🧱 Colonne gauche : Controls + Chart + Positions */}
      <div className="bg-chart-bg flex-grow h-full flex flex-col overflow-x-hidden">
        {/* 1️⃣ Barre pair / prix / timeframes */}
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

        {/* 2️⃣ Graphique */}
        <div className="flex-1 min-h-0">
          <LightweightChart data={data} positions={positions} />
        </div>

        {/* 3️⃣ Positions */}
        {/* 3️⃣ Positions */}
<div className="h-[268px] border-t border-border bg-white overflow-hidden">
  <div className="w-full h-full">
    <PositionsSection 
      paymasterEnabled={paymasterEnabled}
      currentAssetId={selectedAsset.id}
      currentAssetSymbol={selectedAsset.symbol.split("/")[0]}
    />
  </div>
</div>

      </div>

      {/* 🧱 Colonne droite : Order Panel */}
      <OrderPanel 
        selectedAsset={selectedAsset} 
        currentPrice={finalCurrentPrice}
        // 👉 on passe l’état + le toggle au panneau d’ordres
        paymasterEnabled={paymasterEnabled}
        onTogglePaymaster={() => setPaymasterEnabled(prev => !prev)}
      />
    </section>
  );
};

export default TradingSection;
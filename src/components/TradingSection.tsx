import OrderPanel from "./OrderPanel";
import { LightweightChart } from "./LightweightChart";
import { useChartData } from "@/hooks/useChartData";
import { usePositions } from "@/hooks/usePositions";

const TradingSection = () => {
  const { data } = useChartData();
  const { positions } = usePositions();

  return (
    <section id="trading" className="snap-section flex h-screen w-full">
      {/* Chart Area (Full Bleed) */}
      <div className="bg-chart-bg flex-grow h-full">
        <LightweightChart data={data} positions={positions} />
      </div>

      {/* Order Panel */}
      <OrderPanel />
    </section>
  );
};

export default TradingSection;

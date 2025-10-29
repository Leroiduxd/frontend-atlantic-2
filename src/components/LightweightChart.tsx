import { useEffect, useRef } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi,
  CandlestickData,
  Time
} from 'lightweight-charts';

interface ChartData {
  time: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface Position {
  id: number;
  entry_x6: number;
  long_side: boolean;
  lots: number;
  pnl_usd6: number | null;
}

interface LightweightChartProps {
  data: ChartData[];
  positions?: Position[];
}

export const LightweightChart = ({ data, positions = [] }: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      const gridColor = 'rgba(0, 0, 0, 0.15)';
      const borderColor = 'rgba(0, 0, 0, 0.25)';
      const textColor = '#757575';

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#f3f4f6' },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor, style: 0, visible: true },
          horzLines: { color: gridColor, style: 0, visible: true },
        },
        rightPriceScale: {
          borderColor: borderColor,
          textColor: textColor,
          visible: true,
        },
        timeScale: {
          borderColor: borderColor,
          timeVisible: true,
          secondsVisible: false,
          visible: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
          axisDoubleClickReset: true,
        },
        crosshair: {
          mode: 0,
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });

      const series = chart.addSeries({
        type: 'Candlestick' as any,
        upColor: '#3b82f6',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#3b82f6',
        wickDownColor: '#ef4444',
        wickUpColor: '#3b82f6',
        priceFormat: {
          type: 'custom',
          formatter: (price: any) => formatPrice(price),
        },
      } as any);

      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            console.warn('Error removing chart:', e);
          }
          chartRef.current = null;
          seriesRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      try {
        const formattedData = data.map(item => ({
          time: Math.floor(parseInt(item.time) / 1000) as Time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
        }));

        seriesRef.current.setData(formattedData);
      } catch (error) {
        console.error('Error setting chart data:', error);
      }
    }
  }, [data]);

  useEffect(() => {
    if (!seriesRef.current || !positions || positions.length === 0) return;

    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {
        console.warn('Error removing price line:', e);
      }
    });
    priceLinesRef.current = [];

    positions.forEach(position => {
      try {
        const entryPrice = position.entry_x6 / 1000000;
        const pnl = position.pnl_usd6 ? position.pnl_usd6 / 1000000 : 0;
        const pnlText = pnl >= 0 ? `+$${formatPrice(pnl)}` : `-$${formatPrice(Math.abs(pnl))}`;
        const positionType = position.long_side ? 'LONG' : 'SHORT';
        
        const priceLine = seriesRef.current.createPriceLine({
          price: entryPrice,
          color: position.long_side ? '#3b82f6' : '#ef4444',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${positionType} ${pnlText}`,
        });

        priceLinesRef.current.push(priceLine);
      } catch (error) {
        console.error('Error creating price line:', error);
      }
    });
  }, [positions]);

  return (
    <div className="w-full h-full relative">
      <div ref={chartContainerRef} className="w-full h-full" />
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-light-text italic text-xl">Loading chart data...</div>
        </div>
      )}
    </div>
  );
};

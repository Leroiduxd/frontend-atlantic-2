import { useEffect, useRef, useMemo } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi,
  CandlestickSeries, 
  Time,
  CandlestickData
} from 'lightweight-charts';

// ... (Interfaces ChartData, Position, LightweightChartProps inchangées) ...

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

  const colors = useMemo(() => ({
    bg: '#f3f4f6',
    grid: 'rgba(0, 0, 0, 0.15)',
    border: 'rgba(0, 0, 0, 0.25)',
    text: '#757575',
    up: '#3b82f6',
    down: '#ef4444',
  }), []);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  // Initialisation du graphique (inchangée)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      chartRef.current?.remove();
      chartRef.current = null;
    } catch (e) {
      console.warn('Error cleaning up previous chart:', e);
    }
    
    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: colors.bg },
          textColor: colors.text,
        },
        grid: {
          vertLines: { color: colors.grid, style: 0, visible: true },
          horzLines: { color: colors.grid, style: 0, visible: true },
        },
        rightPriceScale: {
          borderColor: colors.border,
          textColor: colors.text,
          visible: true,
        },
        timeScale: {
          borderColor: colors.border,
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

      const series = chart.addSeries(CandlestickSeries, {
        upColor: colors.up,
        downColor: colors.down,
        borderDownColor: colors.down,
        borderUpColor: colors.up,
        wickDownColor: colors.down,
        wickUpColor: colors.up,
        priceFormat: {
          type: 'custom',
          formatter: (price: any) => formatPrice(price),
        },
      });

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
  }, [colors]);

  // Mise à jour des données du graphique (inchangée)
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      try {
        const formattedData: CandlestickData[] = data.map(item => ({
          time: Math.floor(parseInt(item.time) / 1000) as Time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
        }));

        seriesRef.current.setData(formattedData);
        chartRef.current?.timeScale().scrollToRealTime();
        
      } catch (error) {
        console.error('Error setting chart data:', error);
      }
    }
  }, [data]);

  // 🛑 MODIFICATION ICI : Désactive la création des lignes de position.
  useEffect(() => {
    if (!seriesRef.current) return;
    
    // Nettoyage des anciennes lignes (doit rester pour retirer celles déjà dessinées)
    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {
        console.warn('Error removing price line:', e);
      }
    });
    priceLinesRef.current = [];

    // 🔴 RETIRER/COMMENTER LE BLOC SUIVANT POUR DÉSACTIVER LES LIGNES :
    /*
    if (!positions || positions.length === 0) return;

    positions.forEach(position => {
      if (position.entry_x6) { 
        try {
          const entryPrice = position.entry_x6 / 1000000;
          const pnl = position.pnl_usd6 ? position.pnl_usd6 / 1000000 : 0;
          const pnlText = pnl >= 0 ? `+$${formatPrice(pnl)}` : `-$${formatPrice(Math.abs(pnl))}`;
          const positionType = position.long_side ? 'LONG' : 'SHORT';
          
          const priceLine = seriesRef.current.createPriceLine({
            price: entryPrice,
            color: position.long_side ? colors.up : colors.down,
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${positionType} ${pnlText}`,
          });

          priceLinesRef.current.push(priceLine);
        } catch (error) {
          console.error('Error creating price line:', error);
        }
      }
    });
    */
    // Fin du bloc commenté.
  }, [positions, colors]);

  return (
    <div className="w-full h-[calc(100%-3rem)] relative">
      <div ref={chartContainerRef} className="w-full h-full" />
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-light-text italic text-xl">Loading chart data...</div>
        </div>
      )}
    </div>
  );
};
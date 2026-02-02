"use client";

import { useEffect, useRef, useMemo, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi,
  CandlestickSeries, 
  ISeriesApi,
  Time,
  CandlestickData
} from 'lightweight-charts';

// --- Interfaces ---

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
  isPositionsCollapsed?: boolean; 
}

export const LightweightChart = ({ 
  data, 
  positions = [], 
  isPositionsCollapsed 
}: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [isDark, setIsDark] = useState(false);

  // 1. Détection du thème
  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 2. Définition des couleurs (Ajusté pour correspondre à l'arrière-plan demandé)
  const colors = useMemo(() => ({
    // FOND DU GRAPHIQUE : #18181b (Gris Sombre) vs #ffffff (Blanc Pur)
    bg: isDark ? '#000000' : '#ffffff', 
    grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.15)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.25)',
    text: isDark ? '#a1a1aa' : '#757575',
    up: '#3b82f6',
    down: '#ef4444',
  }), [isDark]);

  const formatPrice = (price: number) => {
    if (price === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(price)).toString().length;
    if (integerPart === 1) return price.toFixed(5);
    if (integerPart === 2) return price.toFixed(3);
    return price.toFixed(2);
  };

  // ---------------------------------------------------------
  // EFFET 1 : Initialisation UNIQUE du graphique
  // ---------------------------------------------------------
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        fontFamily: 'Source Code Pro, monospace',
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: {
        borderColor: colors.border,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  // ---------------------------------------------------------
  // EFFET 2 : Mise à jour dynamique des COULEURS
  // ---------------------------------------------------------
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [colors]);


  // ---------------------------------------------------------
  // EFFET 3 : Redimensionnement fluide
  // ---------------------------------------------------------
  useEffect(() => {
    if (chartContainerRef.current && chartRef.current) {
      const performResize = () => {
        chartRef.current?.applyOptions({
          width: chartContainerRef.current!.clientWidth,
          height: chartContainerRef.current!.clientHeight,
        });
      };

      const t1 = setTimeout(performResize, 70);
      const t2 = setTimeout(performResize, 150);
      const t3 = setTimeout(() => {
        performResize();
      }, 300); 

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isPositionsCollapsed]);


  // ---------------------------------------------------------
  // EFFET 4 : Mise à jour des DONNÉES
  // ---------------------------------------------------------
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: CandlestickData[] = data.map(item => ({
        time: Math.floor(parseInt(item.time) / 1000) as Time,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
      }));
      
      seriesRef.current.setData(formattedData);
    }
  }, [data]);

  return (
    // FOND DU CONTENEUR : bg-white (Clair) vs dark:bg-[#18181b] (Gris Sombre)
    <div className="w-full h-full relative transition-colors duration-300 bg-white dark:bg-[#18181b]">
      <div ref={chartContainerRef} className="w-full h-full" />
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
          <div className="text-zinc-500 italic text-xl">Loading chart data...</div>
        </div>
      )}
    </div>
  );
};
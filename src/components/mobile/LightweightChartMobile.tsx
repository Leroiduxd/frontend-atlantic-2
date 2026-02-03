"use client";

import { useEffect, useRef, useMemo, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi,
  CandlestickSeries, 
  ISeriesApi,
  Time,
  CandlestickData,
  CrosshairMode,
  MouseEventParams
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

interface LightweightChartMobileProps {
  data: ChartData[];
  symbol?: string; // Pour afficher dans la légende
}

export const LightweightChartMobile = ({ 
  data, 
  symbol = "BTC/USD"
}: LightweightChartMobileProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [isDark, setIsDark] = useState(false);
  
  // État pour la légende flottante (OHLC)
  const [legendData, setLegendData] = useState<{ open: string; high: string; low: string; close: string; change: number } | null>(null);

  // 1. Détection du thème
  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 2. Couleurs adaptées mobile (BLEU / ROUGE)
  const colors = useMemo(() => ({
    bg: isDark ? '#000000' : '#ffffff', 
    grid: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)', 
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    text: isDark ? '#71717a' : '#a1a1aa',
    
    // --- CHANGEMENT ICI : Bleu au lieu de Vert ---
    up: '#3b82f6', // Bleu (Tailwind Blue-500)
    down: '#ef4444', // Rouge (Tailwind Red-500)
  }), [isDark]);

  const formatPrice = (price: number) => {
    if (!price && price !== 0) return "-";
    if (price === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(price)).toString().length;
    if (integerPart === 1) return price.toFixed(5);
    if (integerPart === 2) return price.toFixed(3);
    return price.toFixed(2);
  };

  // ---------------------------------------------------------
  // INITIALISATION DU GRAPHIQUE
  // ---------------------------------------------------------
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      // Configuration Mobile Spécifique
      rightPriceScale: {
        borderColor: 'transparent', 
        scaleMargins: {
          top: 0.1, 
          bottom: 0.1,
        },
        visible: true,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet, 
        vertLine: {
          width: 1,
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          style: 3,
        },
      },
      kineticScroll: {
        touch: true,
        mouse: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
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
      priceFormat: { type: 'custom', formatter: formatPrice },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // --- GESTION DE LA LÉGENDE FLOTTANTE ---
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (param.time && seriesRef.current) {
        const data = param.seriesData.get(seriesRef.current) as CandlestickData;
        if (data) {
          const open = data.open as number;
          const close = data.close as number;
          const change = ((close - open) / open) * 100;
          setLegendData({
            open: formatPrice(open),
            high: formatPrice(data.high as number),
            low: formatPrice(data.low as number),
            close: formatPrice(close),
            change,
          });
        }
      } else {
        setLegendData(null);
      }
    });

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
  // UPDATE COULEURS
  // ---------------------------------------------------------
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      timeScale: { borderColor: colors.border },
    });

    seriesRef.current.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      borderUpColor: colors.up,
      borderDownColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
  }, [colors]);

  // ---------------------------------------------------------
  // UPDATE DATA & INITIAL LEGEND
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

      // Initialiser la légende avec la dernière bougie
      const last = formattedData[formattedData.length - 1];
      if (last) {
        const open = last.open as number;
        const close = last.close as number;
        const change = ((close - open) / open) * 100;
        setLegendData({
          open: formatPrice(open),
          high: formatPrice(last.high as number),
          low: formatPrice(last.low as number),
          close: formatPrice(close),
          change
        });
      }
    }
  }, [data]);

  return (
    <div className="w-full h-full relative bg-white dark:bg-[#000000]">
      {/* LÉGENDE MOBILE FLOTTANTE (OHLC) */}
      <div className="absolute top-2 left-3 z-10 flex flex-col pointer-events-none select-none">
        <span className="text-[10px] font-bold text-slate-900 dark:text-white opacity-50 mb-0.5">
          {symbol}
        </span>
        {legendData ? (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <div className="flex flex-col">
              <span className="text-slate-400 dark:text-zinc-600 text-[8px]">O</span>
              <span className={legendData.change >= 0 ? "text-blue-500" : "text-red-500"}>{legendData.open}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 dark:text-zinc-600 text-[8px]">H</span>
              <span className={legendData.change >= 0 ? "text-blue-500" : "text-red-500"}>{legendData.high}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 dark:text-zinc-600 text-[8px]">L</span>
              <span className={legendData.change >= 0 ? "text-blue-500" : "text-red-500"}>{legendData.low}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 dark:text-zinc-600 text-[8px]">C</span>
              <span className={legendData.change >= 0 ? "text-blue-500" : "text-red-500"}>{legendData.close}</span>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 dark:text-zinc-600 italic">
            Loading...
          </div>
        )}
      </div>

      <div ref={chartContainerRef} className="w-full h-full" />
      
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
          <div className="text-zinc-400 dark:text-zinc-600 text-sm">Loading data...</div>
        </div>
      )}
    </div>
  );
};
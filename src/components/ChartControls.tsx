"use client";

import { useState, useEffect } from "react";
import { Maximize } from "lucide-react";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useTheme } from "next-themes"; 
import { AssetSelector } from "./AssetSelector"; 

export interface Asset {
  id: number;
  name: string;
  symbol: string;
  pair?: string;
  currentPrice?: string;
  change24h?: string;
}

interface ChartControlsProps {
  selectedAsset: Asset;
  onAssetChange: (asset: Asset) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  priceChange: number;
  priceChangePercent: number;
  currentPrice: number;
}

const TIMEFRAMES = [
  { value: "60", label: "1m" },
  { value: "300", label: "5m" },
  { value: "900", label: "15m" },
  { value: "3600", label: "1h" },
  { value: "14400", label: "4h" },
  { value: "86400", label: "1D" },
];

const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

interface OpenTradeStat {
    assetId: number;
    isLong: number;
    openCount: number;
    avgLeverage: number;
}

const formatCompactUSD = (val: number) => {
    if (val === 0) return "$0";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
};

export const ChartControls = (props: ChartControlsProps) => {
  const { selectedAsset, onAssetChange, selectedTimeframe, onTimeframeChange, currentPrice, priceChange, priceChangePercent } = props;
  
  const { data: wsData } = useWebSocket();
  const assetsByCat = getAssetsByCategory(wsData);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [openTradesStats, setOpenTradesStats] = useState<OpenTradeStat[]>([]);

  useEffect(() => {
    const fetchOpenTradesStats = async () => {
        try {
            const response = await fetch('https://api.brokex.trade/stats/open-trades');
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setOpenTradesStats(data.data);
            }
        } catch (error) { console.error("Failed to fetch open trades stats:", error); }
    };
    fetchOpenTradesStats();
    const intervalId = setInterval(fetchOpenTradesStats, 30000); 
    return () => clearInterval(intervalId);
  }, []);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  const getOpenInterestInUSD = (assetId: number, isLong: boolean, assetCurrentPriceStr: string) => {
      const stat = openTradesStats.find(s => s.assetId === assetId && s.isLong === (isLong ? 1 : 0));
      if (!stat) return null;
      const lotSize = ASSET_LOT_SIZES[assetId] !== undefined ? ASSET_LOT_SIZES[assetId] : 1;
      const assetPrice = parseFloat(assetCurrentPriceStr || '0');
      const exposureAsset = stat.openCount * lotSize;
      const exposureUSD = exposureAsset * assetPrice;
      
      // MODIFICATION : On ne retourne plus le levier, juste la valeur en USD
      return formatCompactUSD(exposureUSD);
  };

  const isPositive = priceChangePercent >= 0;
  const colorClass = isPositive ? "text-blue-500" : "text-red-500";
  
  const selectedLongOI = getOpenInterestInUSD(selectedAsset.id, true, currentPrice.toString()) || "-";
  const selectedShortOI = getOpenInterestInUSD(selectedAsset.id, false, currentPrice.toString()) || "-";

  // MOCK des valeurs OHLC
  const openPrice = currentPrice - priceChange;
  const highPrice = Math.max(openPrice, currentPrice) * 1.002;
  const lowPrice = Math.min(openPrice, currentPrice) * 0.998;
  const closePrice = currentPrice;

  return (
    <div className="w-full bg-white dark:bg-black flex flex-col transition-colors duration-300 border-b border-gray-200 dark:border-zinc-800">
      
      {/* --- LIGNE 1 : SÉLECTEUR, STATS PRINCIPALES & RÉSEAU --- */}
      <div className="flex items-center justify-between px-4 h-[56px]">
        
        <div className="flex items-center h-full">
            <AssetSelector 
                selectedAsset={selectedAsset}
                onAssetChange={onAssetChange}
                isDark={isDark}
                assetsByCat={assetsByCat}
                openTradesStats={openTradesStats}
            />

            {/* MODIFICATION : Ajout des séparateurs (w-px h-6) et réduction du gap (gap-4) */}
            <div className="flex items-center gap-4 pl-6">
                
                {/* Prix */}
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Price</span>
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-white leading-none">{formatPrice(currentPrice)}</span>
                </div>

                <div className="w-px h-6 bg-gray-300 dark:bg-zinc-800"></div>

                {/* 24h Change */}
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">24h Change</span>
                    <span className={`font-mono text-sm font-semibold ${colorClass} leading-none`}>
                        {isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%
                    </span>
                </div>

                <div className="w-px h-6 bg-gray-300 dark:bg-zinc-800"></div>

                {/* OI (L) */}
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">OI (L)</span>
                    <span className="font-mono text-xs font-semibold text-blue-500 leading-none">{selectedLongOI}</span>
                </div>

                <div className="w-px h-6 bg-gray-300 dark:bg-zinc-800"></div>

                {/* OI (S) */}
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">OI (S)</span>
                    <span className="font-mono text-xs font-semibold text-red-500 leading-none">{selectedShortOI}</span>
                </div>

                <div className="w-px h-6 bg-gray-300 dark:bg-zinc-800"></div>

                {/* Funding (L) */}
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">Funding (L)</span>
                    <span className="font-mono text-xs font-semibold text-blue-500 leading-none">-</span>
                </div>

                <div className="w-px h-6 bg-gray-300 dark:bg-zinc-800"></div>

                {/* Funding (S) */}
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">Funding (S)</span>
                    <span className="font-mono text-xs font-semibold text-red-500 leading-none">-</span>
                </div>
            </div>
        </div>

        <div className="flex items-center h-full pl-4">
            <div className="flex items-center gap-2 cursor-default px-3 py-1.5 rounded bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>
                <span className="text-[10px] font-bold text-slate-900 dark:text-zinc-300">Atlantic Testnet</span>
            </div>
        </div>
      </div>

      {/* --- LIGNE 2 : OHLC & TIMEFRAMES --- */}
      <div className="flex items-center justify-between px-4 h-[32px] bg-slate-50/50 dark:bg-black border-t border-gray-100 dark:border-zinc-800/80">
          
          <div className="flex items-center gap-4 text-[11px] font-mono">
              <div className="flex items-center gap-3">
                  <span><span className="text-zinc-500 mr-1">O</span><span className="text-slate-700 dark:text-zinc-300">{formatPrice(openPrice)}</span></span>
                  <span><span className="text-zinc-500 mr-1">H</span><span className="text-slate-700 dark:text-zinc-300">{formatPrice(highPrice)}</span></span>
                  <span><span className="text-zinc-500 mr-1">L</span><span className="text-slate-700 dark:text-zinc-300">{formatPrice(lowPrice)}</span></span>
                  <span><span className="text-zinc-500 mr-1">C</span><span className="text-slate-700 dark:text-zinc-300">{formatPrice(closePrice)}</span></span>
              </div>
              
              <div className="w-px h-3 bg-gray-300 dark:bg-zinc-700"></div>
              
              <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Var:</span>
                  <span className={`${colorClass} font-semibold flex items-center gap-1`}>
                      {isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%
                      <span className="text-zinc-500 font-normal">({isPositive ? "+" : ""}{formatPrice(priceChange)}$)</span>
                  </span>
              </div>
          </div>

          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {TIMEFRAMES.map((tf) => (
                  <button 
                    key={tf.value} 
                    className={`text-[11px] font-semibold transition-colors ${selectedTimeframe === tf.value ? 'text-blue-500' : 'text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300'}`} 
                    onClick={() => onTimeframeChange(tf.value)}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-3 bg-gray-300 dark:bg-zinc-700"></div>

              <button className="text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300 transition-colors" title="Fullscreen">
                  <Maximize size={13} strokeWidth={2.5} />
              </button>
          </div>

      </div>
    </div>
  );
};
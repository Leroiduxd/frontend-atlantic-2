"use client";

import React, { useState, useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

// --- CONSTANTES & UTILITAIRES ---
const ASSET_LOT_SIZES: Record<number, number> = {
  0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatDynamicPrice = (val: number) => {
    if (val === 0) return "$0.00";
    const fractionDigits = val >= 10 ? 2 : 5;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(val);
};

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================
interface ExposureTreemapProps {
  exposures: any;
  currentPrices: Record<number, number>;
  onNavigateAsset: (id: number) => void;
}

export default function ExposureTreemap({ exposures, currentPrices, onNavigateAsset }: ExposureTreemapProps) {
  const [treemapMode, setTreemapMode] = useState<'lp' | 'margin'>('lp');

  const treemapData = useMemo(() => {
    if (!exposures || Object.keys(exposures).length === 0) return [];
    
    return Object.values(exposures)
      .map((exp: any) => {
        const assetId = Number(exp.id);
        const lotMultiplier = ASSET_LOT_SIZES[assetId] || 1;
        
        const longLotsRaw = Number(exp.longLots) || 0;
        const shortLotsRaw = Number(exp.shortLots) || 0;
        const longAssetSize = longLotsRaw * lotMultiplier;
        const shortAssetSize = shortLotsRaw * lotMultiplier;

        const currentPrice = currentPrices[assetId] || 0;
        const longValueSumE6 = Number(exp.longValueSum) / 1_000_000;
        const shortValueSumE6 = Number(exp.shortValueSum) / 1_000_000;

        const avgLongPrice = longAssetSize > 0 ? (longValueSumE6 / longAssetSize) : 0;
        const avgShortPrice = shortAssetSize > 0 ? (shortValueSumE6 / shortAssetSize) : 0;

        const longPnl = longAssetSize > 0 && currentPrice > 0 ? (currentPrice - avgLongPrice) * longAssetSize : 0;
        const shortPnl = shortAssetSize > 0 && currentPrice > 0 ? (avgShortPrice - currentPrice) * shortAssetSize : 0;
        const totalRawPnl = longPnl + shortPnl;

        const longMargin = Number(exp.longMaxLoss) / 1_000_000;
        const shortMargin = Number(exp.shortMaxLoss) / 1_000_000;
        const totalMargin = longMargin + shortMargin;

        const longProfit = Number(exp.longMaxProfit) / 1_000_000;
        const shortProfit = Number(exp.shortMaxProfit) / 1_000_000;
        const totalLpLocked = longProfit + shortProfit;
        
        const isTraderWinning = totalRawPnl > 0;
        const displaySize = treemapMode === 'lp' ? totalLpLocked : totalMargin;
        
        return {
          id: assetId,
          name: exp.name.replace('_', '/').toUpperCase(),
          size: Math.max(0.01, displaySize), // Empêche le bug recharts si taille = 0
          displaySize,
          totalRawPnl,
          longPnl,
          shortPnl,
          avgLongPrice,
          avgShortPrice,
          totalMargin,
          longMargin,
          shortMargin,
          totalLpLocked,
          isTraderWinning,
          hasExposure: totalMargin > 0 || totalLpLocked > 0
        };
      })
      .filter((d) => d.hasExposure) 
      .sort((a, b) => b.size - a.size);
  }, [exposures, currentPrices, treemapMode]);

  if (treemapData.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg overflow-hidden flex flex-col mt-6 h-[700px]">
      <div className="p-5 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/30 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Market Size & Traders PnL Heatmap</h3>
        
        <div className="flex flex-wrap items-center gap-6">
          {/* Toggle Switch */}
          <div className="flex bg-slate-200/60 dark:bg-zinc-800/60 rounded p-1">
            <button 
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${treemapMode === 'lp' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                onClick={() => setTreemapMode('lp')}
            >
                Protocol Exposure (LP Locked)
            </button>
            <button 
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${treemapMode === 'margin' ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                onClick={() => setTreemapMode('margin')}
            >
                Traders Exposure (Margin)
            </button>
          </div>

          <div className="flex gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Traders Winning</span>
            <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Traders Losing</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4/3}
            stroke="none"
            fill="transparent"
            content={(props: any) => <CustomTreemapContent {...props} onNavigateAsset={onNavigateAsset} />}
          >
            <RechartsTooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ==========================================
// SOUS-COMPOSANTS (Blocs & Tooltip)
// ==========================================
const CustomTreemapContent = (props: any) => {
  // depth permet d'identifier le bloc parent (0) des enfants (1)
  const { depth, x, y, width, height, name, isTraderWinning, id, onNavigateAsset } = props;

  // On empêche le bloc parent géant d'être dessiné pour garder le fond transparent
  if (depth === 0) return null;

  const gap = 4; // Espacement entre les cartes
  const innerX = x + gap / 2;
  const innerY = y + gap / 2;
  const innerWidth = Math.max(0, width - gap);
  const innerHeight = Math.max(0, height - gap);

  return (
    <g 
      onClick={() => onNavigateAsset && onNavigateAsset(id)} 
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={innerX}
        y={innerY}
        width={innerWidth}
        height={innerHeight}
        rx={4} // Coins arrondis
        ry={4}
        style={{
          fill: isTraderWinning ? '#ef4444' : '#3b82f6', 
          opacity: 0.85,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      />
      {innerWidth > 60 && innerHeight > 30 && (
        <text
          x={innerX + innerWidth / 2}
          y={innerY + innerHeight / 2}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={12}
          fontWeight="bold"
          fontFamily="monospace"
          dominantBaseline="central"
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-4 rounded shadow-xl text-xs font-mono min-w-[280px] z-50">
        <p className="font-bold text-slate-900 dark:text-white text-base mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800/60">{data.name}</p>
        
        <div className="mb-4">
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Traders Unrealized PnL (Excl. Fees)</p>
            <p className={`text-xl font-bold ${data.totalRawPnl >= 0 ? 'text-red-600 dark:text-red-500' : 'text-blue-600 dark:text-blue-500'}`}>
                {data.totalRawPnl >= 0 ? '+' : ''}{formatUSDExact(data.totalRawPnl)}
            </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 dark:bg-zinc-900/40 p-2 rounded">
            <div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase">Avg Long</p>
                <p className="text-slate-900 dark:text-white font-bold">{formatDynamicPrice(data.avgLongPrice)}</p>
            </div>
            <div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase">Avg Short</p>
                <p className="text-slate-900 dark:text-white font-bold">{formatDynamicPrice(data.avgShortPrice)}</p>
            </div>
        </div>

        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400">Total Traders Margin:</span>
                <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(data.totalMargin)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 ml-2">↳ Longs Margin:</span>
                <span className="text-slate-500">{formatCurrency(data.longMargin)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 ml-2">↳ Shorts Margin:</span>
                <span className="text-slate-500">{formatCurrency(data.shortMargin)}</span>
            </div>
            
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/60 mt-2 flex justify-between items-center">
                <span className="text-slate-600 dark:text-zinc-400">Total LP Locked:</span>
                <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(data.totalLpLocked)}</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};
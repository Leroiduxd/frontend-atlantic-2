"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebSocket, getAssetsByCategory } from '@/hooks/useWebSocket';
import { useTheme } from "next-themes";
import { AssetIcon } from "@/hooks/useAssetIcon";
import { format } from "date-fns";

// --- CONSTANTES ---
const WAD = 1000000000000000000n;

const ASSET_LOT_SIZES: Record<number, number> = {
  0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

const PAIR_MAP: { [key: number]: string } = {
  6004:'aapl_usd', 6005:'amzn_usd', 6010:'coin_usd', 6003:'goog_usd',
  6011:'gme_usd', 6009:'intc_usd', 6059:'ko_usd', 6068:'mcd_usd',
  6001:'msft_usd', 6066:'ibm_usd', 6006:'meta_usd', 6002:'nvda_usd',
  6000:'tsla_usd', 5010:'aud_usd', 5000:'eur_usd', 5002:'gbp_usd',
  5013:'nzd_usd', 5011:'usd_cad', 5012:'usd_chf', 5001:'usd_jpy',
  5501:'xag_usd', 5500:'xau_usd', 0:'btc_usdt', 1:'eth_usdt',
  10:'sol_usdt', 14:'xrp_usdt', 5:'avax_usdt', 3:'doge_usdt',
  15:'trx_usdt', 16:'ada_usdt', 90:'sui_usdt', 2:'link_usdt',
  6034:'nike_usd', 6113:'spdia_usd', 6114:'qqqm_usd', 6115:'iwm_usd'
};

// --- UTILITAIRES ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;

const formatDynamicPrice = (val: number) => {
    if (val === 0) return "$0.00";
    const fractionDigits = val >= 10 ? 2 : 5;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(val);
};

const getDisplaySymbol = (assetId: number): string => {
    if (PAIR_MAP[assetId]) return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
    return `Asset #${assetId}`;
};

const safeFormatDate = (timestamp: any) => {
    if (!timestamp) return "---";
    const date = new Date(Number(timestamp) * 1000);
    if (isNaN(date.getTime())) return "---";
    return format(date, "MMM dd, HH:mm");
};

export default function AssetExplorerView({ assetId, wsData }: { assetId: number, wsData: any }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [stats, setStats] = useState<any>(null);
    const [exposure, setExposure] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // États Funding
    const [liveFunding, setLiveFunding] = useState<any>(null);
    const [avgFunding, setAvgFunding] = useState<any>(null);

    // États Trades
    const [activeTab, setActiveTab] = useState<"open" | "closed" | "orders">("open");
    const [rawOpenTrades, setRawOpenTrades] = useState<any[]>([]);
    const [rawClosedTrades, setRawClosedTrades] = useState<any[]>([]);
    const [rawOrders, setRawOrders] = useState<any[]>([]);

    // États Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    useEffect(() => {
        const fetchAssetData = async () => {
            setIsLoading(true);
            try {
                const [tradesRes, expRes, openRes, closedRes, ordersRes, liveFundingRes, avgFundingRes] = await Promise.all([
                    fetch('https://api.brokex.trade/stats/open-trades'),
                    fetch('https://api.brokex.trade/exposures'),
                    fetch(`https://api.brokex.trade/trades/open/${assetId}`),
                    fetch(`https://api.brokex.trade/trades/closed/${assetId}`),
                    fetch(`https://api.brokex.trade/trades/orders/${assetId}`),
                    fetch(`https://api.brokex.trade/funding/live/${assetId}`).then(r => r.json()).catch(() => null),
                    fetch(`https://api.brokex.trade/stats/funding/${assetId}`).then(r => r.json()).catch(() => null)
                ]);
                
                const tData = await tradesRes.json();
                const eData = await expRes.json();
                const openData = await openRes.json();
                const closedData = await closedRes.json();
                const ordersData = await ordersRes.json();
                
                if (tData.success) {
                    setStats({
                        long: tData.data.find((d:any) => d.assetId === assetId && d.isLong === 1) || { openCount: 0, avgLeverage: 0 },
                        short: tData.data.find((d:any) => d.assetId === assetId && d.isLong === 0) || { openCount: 0, avgLeverage: 0 }
                    });
                }
                
                if (eData.success && eData.data[assetId]) {
                    setExposure(eData.data[assetId]);
                } else {
                    setExposure({ longLots: 0, shortLots: 0, longValueSum: 0, shortValueSum: 0, longMaxProfit: 0, shortMaxProfit: 0, longMaxLoss: 0, shortMaxLoss: 0 });
                }

                if (liveFundingRes && liveFundingRes.success) setLiveFunding(liveFundingRes.data);
                if (avgFundingRes && avgFundingRes.success) setAvgFunding(avgFundingRes.data);

                if (openData.success) setRawOpenTrades(openData.data);
                if (closedData.success) setRawClosedTrades(closedData.data);
                if (ordersData.success) setRawOrders(ordersData.data);

            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        fetchAssetData();
    }, [assetId]);

    // Reset de la page quand on change d'onglet
    useEffect(() => { setCurrentPage(1); }, [activeTab]);

    // Calculs et PnL
    const { openTrades, closedTrades, orderTrades } = useMemo(() => {
        const getAssetWsPrice = (aId: number) => {
            if (!wsData) return 0;
            const categories = getAssetsByCategory(wsData);
            const match = Object.values(categories).flat().find(a => a.id === aId);
            return match && match.currentPrice ? parseFloat(match.currentPrice) : 0;
        };

        const processTrades = (trades: any[]) => {
            return trades.map((t) => {
                const assetMultiplier = ASSET_LOT_SIZES[t.assetId] || 1;
                const size = (t.lotSize - (t.closedLotSize || 0)) * assetMultiplier;
                const entryP = formatE6(t.openPrice);
                const wsPrice = getAssetWsPrice(t.assetId);

                let pnl = 0;
                let fundingFeeUsd = 0;

                if (t.state === 1 && wsPrice > 0) { // Open
                    const rawPnl = size * (wsPrice - entryP) * (t.isLong ? 1 : -1);
                    
                    // Calcul Funding individuel
                    if (liveFunding && t.fundingIndex) {
                        const currentLiveIndexStr = t.isLong ? liveFunding.liveLongIndex : liveFunding.liveShortIndex;
                        const currentLiveIndex = BigInt(currentLiveIndexStr || "0");
                        const tradeEntryIndex = BigInt(t.fundingIndex || "0");
                        
                        if (currentLiveIndex > tradeEntryIndex) {
                            const deltaIndexWad = currentLiveIndex - tradeEntryIndex;
                            const deltaIndexDecimal = Number(deltaIndexWad) / Number(WAD);
                            const exitNotional = wsPrice * size;
                            fundingFeeUsd = exitNotional * deltaIndexDecimal;
                        }
                    }
                    pnl = rawPnl - fundingFeeUsd;

                } else if (t.state === 2) { // Closed
                    const closeSize = (t.closedLotSize || t.lotSize) * assetMultiplier;
                    pnl = closeSize * (formatE6(t.closePrice) - entryP) * (t.isLong ? 1 : -1);
                }

                return { ...t, displaySize: size, pnl, currentPrice: wsPrice };
            }).sort((a, b) => b.openTimestamp - a.openTimestamp);
        };

        return { 
            openTrades: processTrades(rawOpenTrades), 
            closedTrades: processTrades(rawClosedTrades), 
            orderTrades: processTrades(rawOrders) 
        };
    }, [rawOpenTrades, rawClosedTrades, rawOrders, wsData, liveFunding]);

    // Métriques d'exposition globale
    const metrics = useMemo(() => {
        if (!exposure || !stats) return null;
        
        const lotMultiplier = ASSET_LOT_SIZES[assetId] || 1;
        const longLotsRaw = Number(exposure.longLots) || 0;
        const shortLotsRaw = Number(exposure.shortLots) || 0;
        
        const longAssetSize = longLotsRaw * lotMultiplier;
        const shortAssetSize = shortLotsRaw * lotMultiplier;

        const avgLongPrice = longLotsRaw > 0 ? (formatE6(exposure.longValueSum) / longAssetSize) : 0;
        const avgShortPrice = shortLotsRaw > 0 ? (formatE6(exposure.shortValueSum) / shortAssetSize) : 0;

        const categories = getAssetsByCategory(wsData);
        const match = Object.values(categories).flat().find(a => a.id === assetId);
        const currentPrice = match && match.currentPrice ? parseFloat(match.currentPrice) : 0;

        // PnL Brut
        const rawLongPnl = longLotsRaw > 0 ? (currentPrice - avgLongPrice) * longAssetSize : 0;
        const rawShortPnl = shortLotsRaw > 0 ? (avgShortPrice - currentPrice) * shortAssetSize : 0;

        // Calcul des Frais de Funding Globaux
        let longFundingFeeUsd = 0;
        let shortFundingFeeUsd = 0;

        if (liveFunding && avgFunding && currentPrice > 0) {
            const liveLong = BigInt(liveFunding.liveLongIndex || "0");
            const liveShort = BigInt(liveFunding.liveShortIndex || "0");
            const avgLongIdx = BigInt(avgFunding.longAvgFundingIndex || "0");
            const avgShortIdx = BigInt(avgFunding.shortAvgFundingIndex || "0");

            if (liveLong > avgLongIdx) {
                const deltaLong = Number(liveLong - avgLongIdx) / Number(WAD);
                longFundingFeeUsd = deltaLong * (currentPrice * longAssetSize);
            }
            if (liveShort > avgShortIdx) {
                const deltaShort = Number(liveShort - avgShortIdx) / Number(WAD);
                shortFundingFeeUsd = deltaShort * (currentPrice * shortAssetSize);
            }
        }

        // PnL Net
        const longPnl = rawLongPnl - longFundingFeeUsd;
        const shortPnl = rawShortPnl - shortFundingFeeUsd;

        const totalAssetSize = longAssetSize + shortAssetSize;
        const longLotsPercent = totalAssetSize > 0 ? (longAssetSize / totalAssetSize) * 100 : 50;
        const shortLotsPercent = totalAssetSize > 0 ? (shortAssetSize / totalAssetSize) * 100 : 50;
        
        const baseSymbol = PAIR_MAP[assetId] ? PAIR_MAP[assetId].split('_')[0].toUpperCase() : '';

        return { 
            avgLongPrice, avgShortPrice, currentPrice, longPnl, shortPnl, 
            totalPnl: longPnl + shortPnl, longAssetSize, shortAssetSize, 
            longLotsPercent, shortLotsPercent, baseSymbol,
            longFundingFeeUsd, shortFundingFeeUsd
        };
    }, [exposure, stats, wsData, assetId, liveFunding, avgFunding]);

    // Données Actuelles & Pagination
    const fullDataList = activeTab === "open" ? openTrades : activeTab === "closed" ? closedTrades : orderTrades;
    const totalPages = Math.ceil(fullDataList.length / itemsPerPage);
    const paginatedData = fullDataList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (isLoading) return <div className="p-12 text-center text-slate-500 font-mono text-sm w-full animate-pulse">Loading market data...</div>;
    if (!exposure || (!exposure.longLots && !exposure.shortLots && rawOpenTrades.length === 0)) return <div className="p-12 text-center text-slate-500 font-mono text-sm w-full">No active exposure for this asset.</div>;

    const symbol = getDisplaySymbol(assetId);

    return (
        <div className="w-full flex flex-col gap-6">
            
            {/* ========================================= */}
            {/* PARTIE 1 : RÉSUMÉ GLOBAL DE L'ACTIF       */}
            {/* ========================================= */}
            <div className="w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm">
                {/* EN-TETE ACTIF */}
                <div className="p-8 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-xl">
                            <AssetIcon assetId={assetId} isDark={isDark} size="28px" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{symbol} Market Data</h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-500 font-mono mt-1">Real-time exposure and global net PnL analysis.</p>
                        </div>
                    </div>
                    <div className="text-left md:text-right">
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Mark Price</p>
                        <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{metrics?.currentPrice ? formatDynamicPrice(metrics.currentPrice) : '---'}</p>
                    </div>
                </div>

                {/* RÉSUMÉ GLOBAL (Lots & PnL) */}
                <div className="p-6 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-950/20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Global Net PnL (After Funding)</p>
                            <p className={`text-2xl font-mono font-bold ${metrics!.totalPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                                {metrics!.totalPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.totalPnl)}
                            </p>
                        </div>
                        <div className="col-span-2 flex flex-col justify-center">
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2 flex justify-between">
                                <span>Long Exposure: {metrics!.longAssetSize.toFixed(4)} {metrics!.baseSymbol}</span>
                                <span>Short Exposure: {metrics!.shortAssetSize.toFixed(4)} {metrics!.baseSymbol}</span>
                            </p>
                            <div className="w-full h-2.5 bg-slate-200 dark:bg-zinc-900 rounded-full flex overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${metrics!.longLotsPercent}%` }}></div>
                                <div className="h-full bg-red-500" style={{ width: `${metrics!.shortLotsPercent}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-zinc-800/60">
                    {/* LONG COLUMN */}
                    <div className="p-8 space-y-8 bg-transparent">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="text-blue-600 dark:text-blue-500" size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Long Data</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Open Positions</p><p className="text-lg font-mono text-slate-900 dark:text-white">{stats.long.openCount} <span className="text-xs text-slate-400 dark:text-zinc-500">(~{stats.long.avgLeverage.toFixed(1)}x avg)</span></p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Asset Exposure</p><p className="text-lg font-mono text-slate-900 dark:text-white">{metrics!.longAssetSize.toFixed(4)} {metrics!.baseSymbol}</p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Avg Entry Price</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatDynamicPrice(metrics!.avgLongPrice)}</p></div>
                            <div></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> LP Locked (Max Profit)</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.longMaxProfit))}</p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Total Margin (Max Loss)</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.longMaxLoss))}</p></div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Longs Net PnL</p>
                                <p className={`text-xl font-mono font-bold ${metrics!.longPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>{metrics!.longPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.longPnl)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Funding Owed</p>
                                <p className="text-sm font-mono text-slate-700 dark:text-zinc-400">-{formatUSDExact(metrics!.longFundingFeeUsd)}</p>
                            </div>
                        </div>
                    </div>

                    {/* SHORT COLUMN */}
                    <div className="p-8 space-y-8 bg-transparent">
                        <div className="flex items-center gap-3">
                            <TrendingDown className="text-red-600 dark:text-red-500" size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Short Data</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Open Positions</p><p className="text-lg font-mono text-slate-900 dark:text-white">{stats.short.openCount} <span className="text-xs text-slate-400 dark:text-zinc-500">(~{stats.short.avgLeverage.toFixed(1)}x avg)</span></p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Asset Exposure</p><p className="text-lg font-mono text-slate-900 dark:text-white">{metrics!.shortAssetSize.toFixed(4)} {metrics!.baseSymbol}</p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Avg Entry Price</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatDynamicPrice(metrics!.avgShortPrice)}</p></div>
                            <div></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> LP Locked (Max Profit)</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.shortMaxProfit))}</p></div>
                            <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Total Margin (Max Loss)</p><p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.shortMaxLoss))}</p></div>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider mb-1">Shorts Net PnL</p>
                                <p className={`text-xl font-mono font-bold ${metrics!.shortPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>{metrics!.shortPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.shortPnl)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Funding Owed</p>
                                <p className="text-sm font-mono text-slate-700 dark:text-zinc-400">-{formatUSDExact(metrics!.shortFundingFeeUsd)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================= */}
            {/* PARTIE 2 : LISTE DES TRADES (AVEC PAGINATION)*/}
            {/* ========================================= */}
            <div className="w-full bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden min-h-[300px]">
                
                {/* STICKY TABS */}
                <div className="flex border-b border-slate-200 dark:border-zinc-800/60 bg-slate-100 dark:bg-zinc-950/30 sticky top-0 z-10 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {['open','closed','orders'].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab as any)} 
                            className={`flex-1 min-w-[90px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === tab ? 'text-slate-900 border-slate-900 bg-white dark:text-white dark:border-white dark:bg-zinc-900/50' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-200/50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900/30'}`}
                        >
                            {tab} ({tab === 'open' ? openTrades.length : tab === 'closed' ? closedTrades.length : orderTrades.length})
                        </button>
                    ))}
                </div>

                <div className="w-full">
                    {fullDataList.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 dark:text-zinc-600 font-mono text-sm">No trades found in this category.</div>
                    ) : (
                        <>
                            {/* VUE MOBILE */}
                            <div className="flex flex-col md:hidden divide-y divide-slate-100 dark:divide-zinc-800/50">
                                {paginatedData.map(trade => (
                                    <div key={trade.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-800 dark:text-zinc-200">
                                                {trade.trader.substring(0, 6)}...{trade.trader.substring(trade.trader.length - 4)}
                                            </div>
                                            <div className="text-[11px] font-bold">
                                                <span className={trade.isLong ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}>
                                                    {trade.isLong ? 'LONG' : 'SHORT'}
                                                </span> 
                                                <span className="text-slate-400 dark:text-zinc-600 ml-1">x{trade.leverage}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-wider">Entry / Size</span>
                                                    <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">
                                                        {formatUSDExact(formatE6(trade.openPrice))} / {trade.displaySize}
                                                    </span>
                                                </div>
                                            </div>
                                            {(activeTab === 'open' || activeTab === 'closed') && (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-wider">Net PnL</span>
                                                    <span className={`font-mono font-bold text-sm ${trade.pnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                                                        {trade.pnl >= 0 ? '+' : ''}{formatUSDExact(trade.pnl)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-zinc-800/50">
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">{safeFormatDate(trade.openTimestamp)}</span>
                                            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500">Margin: {formatUSDExact(formatE6(trade.marginUsdc))}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* VUE DESKTOP */}
                            <div className="hidden md:block overflow-x-auto w-full">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800/60">
                                        <tr>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Trader</th>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Date</th>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Side</th>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Size</th>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Entry</th>
                                            <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Margin</th>
                                            {(activeTab === 'open' || activeTab === 'closed') && <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-right">Net PnL</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                        {paginatedData.map(trade => (
                                            <tr key={trade.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer">
                                                <td className="px-6 py-3 font-mono text-[11px] text-slate-800 dark:text-zinc-200 hover:text-blue-500 transition-colors">
                                                    {trade.trader.substring(0, 6)}...{trade.trader.substring(trade.trader.length - 4)}
                                                </td>
                                                <td className="px-6 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-500">
                                                    {safeFormatDate(trade.openTimestamp)}
                                                </td>
                                                <td className="px-6 py-3 text-[11px] font-bold"><span className={trade.isLong ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}>{trade.isLong ? 'LONG' : 'SHORT'}</span> <span className="text-slate-400 dark:text-zinc-600">x{trade.leverage}</span></td>
                                                <td className="px-6 py-3 text-[11px] font-mono text-slate-700 dark:text-zinc-300">{trade.displaySize}</td>
                                                <td className="px-6 py-3 text-[11px] font-mono text-slate-700 dark:text-zinc-300">{formatUSDExact(formatE6(trade.openPrice))}</td>
                                                <td className="px-6 py-3 text-[11px] font-mono text-slate-700 dark:text-zinc-300">{formatUSDExact(formatE6(trade.marginUsdc))}</td>
                                                {(activeTab === 'open' || activeTab === 'closed') && (
                                                    <td className={`px-6 py-3 text-[11px] font-mono font-bold text-right ${trade.pnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                                                        {trade.pnl >= 0 ? '+' : ''}{formatUSDExact(trade.pnl)}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* CONTROLES DE PAGINATION */}
                            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/30 gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Show:</span>
                                    <select 
                                        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-mono rounded px-2 py-1 outline-none text-slate-700 dark:text-zinc-300"
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1); // Reset à la page 1 si on change la taille
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={30}>30</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500">
                                        Page <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> of {totalPages}
                                    </span>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages || totalPages === 0}
                                            className="p-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

        </div>
    );
}
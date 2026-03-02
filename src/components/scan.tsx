"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Wallet, BarChart3, Activity, ArrowLeft, User, Coins, ShieldAlert, FileText } from 'lucide-react';
import { useWebSocket, getAssetsByCategory } from '@/hooks/useWebSocket';
import { BottomBar } from "@/components/BottomBar";
import { format } from "date-fns";

// NOUVEAUX IMPORTS CORRIGÉS
import { useTheme } from "next-themes";
import { AssetIcon } from "@/hooks/useAssetIcon"; 

// --- CONSTANTES ---
const ASSET_LOT_SIZES: Record<number, number> = {
  0: 0.01, 1: 0.1, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
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

const ASSET_INFO: Record<number, { name: string, symbol: string }> = {
  0: { name: "BTC/USD", symbol: "₿" }, 1: { name: "ETH/USD", symbol: "Ξ" },
  10: { name: "SOL/USD", symbol: "S" }, 5500: { name: "XAU/USD", symbol: "Au" },
};

// --- UTILITAIRES ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatCompact = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;

const getDisplaySymbol = (assetId: number): string => {
    if (PAIR_MAP[assetId]) return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
    return `Asset #${assetId}`;
};

const timeAgo = (timestamp: number) => {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
    if (seconds < 60) return `${seconds} secs ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================
export default function Scan() {
  const { data: wsData } = useWebSocket();
  const [currentAssetId, setCurrentAssetId] = useState<number>(0);
  
  const [view, setView] = useState<'overview' | 'trader' | 'asset'>('overview');
  const [targetQuery, setTargetQuery] = useState<string>(""); 
  
  const [searchInput, setSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredPairs = useMemo(() => {
      if (searchInput.startsWith('0x') || searchInput.trim().length === 0) return [];
      const lowerQ = searchInput.toLowerCase();
      return Object.entries(PAIR_MAP)
          .filter(([_, pairName]) => pairName.includes(lowerQ))
          .map(([id, name]) => ({ id: Number(id), name: name.replace('_', '/') }));
  }, [searchInput]);

  const handleSearch = (e?: React.FormEvent, queryOverride?: string) => {
    if (e) e.preventDefault();
    const query = (queryOverride || searchInput).trim();
    if (!query) return;

    if (query.startsWith('0x') && query.length > 10) {
      setTargetQuery(query);
      setView('trader');
      setShowSuggestions(false);
    } else {
      const lowerQ = query.toLowerCase().replace('/', '_');
      const foundAssetId = Object.keys(PAIR_MAP).find(key => PAIR_MAP[Number(key)] === lowerQ || PAIR_MAP[Number(key)].includes(lowerQ));
      if (foundAssetId) {
        setTargetQuery(foundAssetId);
        setView('asset');
        setShowSuggestions(false);
      } else {
        alert("Invalid format. Enter a Wallet Address or a valid Asset symbol (e.g. BTC, AAPL).");
      }
    }
  };

  const navigateToAsset = (assetId: number) => {
      setTargetQuery(assetId.toString());
      setView('asset');
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 overflow-y-auto pb-[60px] transition-colors duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      {/* HEADER GLOBAL */}
      <div className="w-full flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-zinc-800/50 pt-12 pb-6 px-8 bg-white dark:bg-black sticky top-0 z-40 transition-colors duration-300">
        <div className="flex flex-col gap-2 mb-4 md:mb-0">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setView('overview'); setSearchInput(""); }}>
                {view !== 'overview' && <ArrowLeft size={20} className="text-slate-400 dark:text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors" />}
                <h1 className="text-2xl font-bold tracking-tight group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">Brokex Protocol</h1>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-mono uppercase tracking-wider rounded">Explorer</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
                {view === 'overview' ? "Real-time protocol metrics and execution data." : "Exploring specific protocol data."}
            </p>
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full md:w-[450px]">
            <div className="relative flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-md focus-within:border-slate-400 dark:focus-within:border-zinc-500 transition-colors z-50">
                <input
                    type="text"
                    placeholder="Search Address or Market Symbol"
                    className="flex-1 bg-transparent px-4 h-10 outline-none text-xs placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono text-slate-900 dark:text-white"
                    value={searchInput}
                    onChange={(e) => {
                        setSearchInput(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                <button type="submit" className="w-10 h-10 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white border-l border-slate-200 dark:border-zinc-800 rounded-r-md">
                    <Search size={14} />
                </button>

                {showSuggestions && filteredPairs.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                        {filteredPairs.map(pair => (
                            <div 
                                key={pair.id} 
                                onMouseDown={() => {
                                    setSearchInput(pair.name);
                                    navigateToAsset(pair.id);
                                    setShowSuggestions(false);
                                }}
                                className="px-4 py-2.5 text-xs font-mono cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 uppercase transition-colors"
                            >
                                {pair.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </form>
      </div>

      {/* GESTION DES VUES */}
      <div className="w-full px-8 py-8 space-y-6">
          {view === 'overview' && <OverviewView wsData={wsData} onNavigateTrader={(q) => handleSearch(undefined, q)} onNavigateAsset={navigateToAsset} />}
          {view === 'trader' && <TraderExplorerView address={targetQuery} wsData={wsData} />}
          {view === 'asset' && <AssetExplorerView assetId={Number(targetQuery)} wsData={wsData} />}
      </div>

      <div className="fixed bottom-0 left-0 md:left-[60px] right-0 z-50">
        <BottomBar onAssetSelect={(a) => setCurrentAssetId(a.id)} currentAssetId={currentAssetId} />
      </div>
    </div>
  );
}

// ============================================================================
// VUE 1 : OVERVIEW (Dashboard global)
// ============================================================================
function OverviewView({ wsData, onNavigateTrader, onNavigateAsset }: { wsData: any, onNavigateTrader: (query: string) => void, onNavigateAsset: (id: number) => void }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [totalTraders, setTotalTraders] = useState(0);
  const [openTradesStats, setOpenTradesStats] = useState<any[]>([]);
  const [exposures, setExposures] = useState<any>({});
  const [volume24h, setVolume24h] = useState<number | null>(null);
  
  const [topTradersVol, setTopTradersVol] = useState<any[]>([]); 
  const [topTradersPnl, setTopTradersPnl] = useState<any[]>([]); 
  const [topTradersActive, setTopTradersActive] = useState<any[]>([]); 
  const [traderTab, setTraderTab] = useState<'vol'|'pnl'|'active'>('vol');

  const [latestTrades, setLatestTrades] = useState<any[]>([]);

  const [topMarketIndex, setTopMarketIndex] = useState(0);

  useEffect(() => {
    const fetchApiData = async () => {
      try {
        const [tradersRes, tradesRes, expRes, topVolRes, topPnlRes, topActiveRes, volRes, maxIdRes] = await Promise.all([
          fetch('https://api.brokex.trade/stats/total-traders').catch(() => null),
          fetch('https://api.brokex.trade/stats/open-trades').catch(() => null),
          fetch('https://api.brokex.trade/exposures').catch(() => null),
          fetch('https://api.brokex.trade/metrics/top/volume?limit=10').catch(() => null),
          fetch('https://api.brokex.trade/metrics/top/pnl?limit=10').catch(() => null),
          fetch('https://api.brokex.trade/traders/top/active?limit=10').catch(() => null),
          fetch('https://api.brokex.trade/stats/volume-24h').catch(() => null),
          fetch('https://api.brokex.trade/stats/max-trade-id').catch(() => null)
        ]);

        if (tradersRes) tradersRes.json().then(d => d.success && setTotalTraders(d.totalTraders));
        if (tradesRes) tradesRes.json().then(d => d.success && setOpenTradesStats(d.data));
        if (expRes) expRes.json().then(d => d.success && setExposures(d.data));
        
        if (topVolRes) topVolRes.json().then(d => d.success && Array.isArray(d.data) && setTopTradersVol(d.data));
        if (topPnlRes) topPnlRes.json().then(d => d.success && Array.isArray(d.data) && setTopTradersPnl(d.data));
        if (topActiveRes) topActiveRes.json().then(d => d.success && Array.isArray(d.data) && setTopTradersActive(d.data));
        
        if (volRes) volRes.json().then(d => d.success && setVolume24h(d.volume24h));

        if (maxIdRes) {
            const data = await maxIdRes.json();
            if (data.success && data.maxId) {
                const maxId = data.maxId;
                const tradePromises = [];
                for (let i = 0; i < 12; i++) {
                    if (maxId - i > 0) {
                        tradePromises.push(fetch(`https://api.brokex.trade/trade/${maxId - i}`).then(r => r.json()).catch(() => null));
                    }
                }
                const tradesData = await Promise.all(tradePromises);
                setLatestTrades(tradesData.filter(t => t && !t.error).sort((a,b) => b.openTimestamp - a.openTimestamp));
            }
        }

      } catch (error) { console.error("Erreur API Explorer:", error); }
    };
    fetchApiData();
    const interval = setInterval(fetchApiData, 15000); 
    return () => clearInterval(interval);
  }, []);

  const currentPrices = useMemo(() => {
    if (!wsData) return {};
    const prices: Record<number, number> = {};
    const categories = getAssetsByCategory(wsData);
    Object.values(categories).flat().forEach(asset => { prices[asset.id] = parseFloat(asset.currentPrice || '0'); });
    return prices;
  }, [wsData]);

  const dashboardStats = useMemo(() => {
    let longExpUSD = 0; let shortExpUSD = 0; let longCount = 0; let shortCount = 0;
    let totalLeverage = 0; let totalPositions = 0; let globalUnrealizedPnl = 0;

    openTradesStats.forEach(stat => {
      totalPositions += stat.openCount;
      totalLeverage += stat.openCount * stat.avgLeverage;
      if (stat.isLong === 1) longCount += stat.openCount; else shortCount += stat.openCount;
    });
    const avgLev = totalPositions > 0 ? (totalLeverage / totalPositions) : 0;
    const marketsArray: any[] = [];

    Object.values(exposures).forEach((exp: any) => {
      const assetId = Number(exp.id);
      const lotSize = ASSET_LOT_SIZES[assetId] || 1;
      const longLots = Number(exp.longLots);
      const shortLots = Number(exp.shortLots);
      
      let price = currentPrices[assetId] || (longLots > 0 ? formatE6((Number(exp.longValueSum) * 100) / (longLots * 1)) : 0);
      const assetLongUSD = longLots * lotSize * price;
      const assetShortUSD = shortLots * lotSize * price;

      longExpUSD += assetLongUSD; shortExpUSD += assetShortUSD;

      const avgLongPrice = longLots > 0 ? (formatE6(exp.longValueSum) / (longLots * lotSize)) : 0;
      const avgShortPrice = shortLots > 0 ? (formatE6(exp.shortValueSum) / (shortLots * lotSize)) : 0;

      if (price > 0) {
          globalUnrealizedPnl += (longLots > 0 ? (price - avgLongPrice) * (longLots * lotSize) : 0);
          globalUnrealizedPnl += (shortLots > 0 ? (avgShortPrice - price) * (shortLots * lotSize) : 0);
      }

      if (assetLongUSD > 0 || assetShortUSD > 0) {
        marketsArray.push({ id: assetId, name: exp.name, oiUSD: assetLongUSD + assetShortUSD, price: price });
      }
    });

    marketsArray.sort((a, b) => b.oiUSD - a.oiUSD);
    const totalOI = longExpUSD + shortExpUSD;
    const longPercent = totalOI > 0 ? Math.round((longExpUSD / totalOI) * 100) : 50;
    const shortPercent = totalOI > 0 ? 100 - longPercent : 50;

    return { 
        longExpUSD, shortExpUSD, longCount, shortCount, totalPositions, 
        avgLev, totalOI, longPercent, shortPercent, globalUnrealizedPnl, 
        topMarkets: marketsArray.slice(0, 10) 
    };
  }, [openTradesStats, exposures, currentPrices]);

  useEffect(() => {
      if (dashboardStats.topMarkets.length === 0) return;
      const maxIndex = Math.min(4, dashboardStats.topMarkets.length - 1);
      const interval = setInterval(() => {
          setTopMarketIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
      }, 3500);
      return () => clearInterval(interval);
  }, [dashboardStats.topMarkets.length]);

  const currentTopMarketCarousel = dashboardStats.topMarkets[topMarketIndex];

  return (
    <>
      {/* ROW 1: METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-0 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800/60 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-zinc-800/60 overflow-hidden shadow-sm">
        <Metric title="24H VOLUME (EST)" value={volume24h !== null ? formatCurrency(formatE6(volume24h)) : "---"} icon={<Activity size={14}/>} />
        <Metric title="OPEN INTEREST" value={formatCurrency(dashboardStats.totalOI)} icon={<Wallet size={14}/>} />
        <Metric title="OPEN POSITIONS" value={dashboardStats.totalPositions.toString()} sub={`~${dashboardStats.avgLev.toFixed(1)}x avg`} icon={<BarChart3 size={14}/>} />
        <Metric title="TOTAL TRADERS" value={totalTraders.toString()} icon={<User size={14}/>} />
        <Metric 
            title="UNREALIZED PNL" 
            value={`${dashboardStats.globalUnrealizedPnl >= 0 ? '+' : ''}${formatCurrency(dashboardStats.globalUnrealizedPnl)}`} 
            icon={<Activity size={14}/>} 
            valueColor={dashboardStats.globalUnrealizedPnl >= 0 ? "text-blue-600 dark:text-blue-500" : "text-red-600 dark:text-red-500"} 
        />
        <div className="px-5 py-4 flex flex-col justify-center bg-slate-50 dark:bg-zinc-950/20">
          <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">LONG / SHORT RATIO</p>
          <div className="flex items-center gap-2 font-mono text-sm"><span className="text-blue-600 dark:text-blue-500">{dashboardStats.longPercent}%</span><span className="text-slate-400 dark:text-zinc-600">/</span><span className="text-red-600 dark:text-red-500">{dashboardStats.shortPercent}%</span></div>
          <div className="w-full h-1 bg-slate-200 dark:bg-zinc-900 rounded-full mt-2.5 flex overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${dashboardStats.longPercent}%` }}></div><div className="h-full bg-red-500" style={{ width: `${dashboardStats.shortPercent}%` }}></div></div>
        </div>
      </div>

      {/* ROW 2: EXPOSURE & CAROUSEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg p-5 flex justify-between items-center group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
          <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">Long Exposure</p><p className="text-2xl font-mono text-slate-900 dark:text-white mb-1">{formatCurrency(dashboardStats.longExpUSD)}</p><p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">{dashboardStats.longCount} positions</p></div>
          <div className="w-10 h-10 flex items-center justify-center text-blue-500"><TrendingUp size={24} className="stroke-[2.5]" /></div>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg p-5 flex justify-between items-center group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
          <div><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">Short Exposure</p><p className="text-2xl font-mono text-slate-900 dark:text-white mb-1">{formatCurrency(dashboardStats.shortExpUSD)}</p><p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">{dashboardStats.shortCount} positions</p></div>
          <div className="w-10 h-10 flex items-center justify-center text-red-500"><TrendingDown size={24} className="stroke-[2.5]" /></div>
        </div>
        
        {/* CAROUSEL TOP MARKET */}
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg p-5 group hover:border-slate-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Top Market by OI</p>
              <div className="flex gap-1.5">
                  {dashboardStats.topMarkets.slice(0, 5).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-[2px] transition-colors ${i === topMarketIndex ? 'bg-slate-600 dark:bg-zinc-300' : 'bg-slate-200 dark:bg-zinc-700'}`} />
                  ))}
              </div>
          </div>
          
          {currentTopMarketCarousel ? (
              <div className="flex justify-between items-center cursor-pointer" onClick={() => onNavigateAsset(currentTopMarketCarousel.id)}>
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center">
                          <AssetIcon assetId={currentTopMarketCarousel.id} isDark={isDark} size="16px" />
                      </div>
                      <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">{currentTopMarketCarousel.name.replace('_', '/').toUpperCase()}</p>
                          <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">{formatCompact(currentTopMarketCarousel.oiUSD)} OI</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-slate-900 dark:text-white font-mono text-sm">{formatCurrency(currentTopMarketCarousel.price)}</p>
                  </div>
              </div>
          ) : (<p className="text-xs text-slate-500 dark:text-zinc-600 font-mono">Loading data...</p>)}
        </div>
      </div>

      {/* ROW 3: LISTS (3 Colonnes) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LATEST ORDERS */}
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-5 text-slate-900 dark:text-white tracking-tight">Latest Orders</h3>
          <div className="space-y-1">
            {latestTrades.map((trade, i) => {
                const isClose = trade.state === 2 || trade.state === 3;
                const notionalUsd = formatE6(trade.marginUsdc) * trade.leverage;
                
                return (
                  <div key={trade.id || i} className="flex justify-between items-center py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/50 px-3 rounded transition-colors cursor-pointer group" onClick={() => onNavigateTrader(trade.trader)}>
                      <div className="flex items-center gap-3">
                          <div className="w-6 h-6 flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
                              <AssetIcon assetId={trade.assetId} isDark={isDark} size="14px" />
                          </div>
                          <div>
                              <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                  {isClose ? 'Close' : 'Open'} <span className="font-bold">{getDisplaySymbol(trade.assetId).replace('/USD', '')}</span> <span className={trade.isLong ? 'text-blue-500' : 'text-red-500'}>{trade.isLong ? 'Long' : 'Short'}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono mt-0.5">
                                  From {trade.trader.substring(0, 6)}...{trade.trader.substring(trade.trader.length - 4)}
                              </p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-[11px] font-mono text-slate-900 dark:text-white">{formatCurrency(notionalUsd)}</p>
                          <p className="text-[9px] text-slate-400 dark:text-zinc-600 uppercase mt-0.5 tracking-widest">{timeAgo(trade.openTimestamp)}</p>
                      </div>
                  </div>
                )
            })}
            {latestTrades.length === 0 && <p className="text-xs text-slate-500 dark:text-zinc-600 font-mono text-center py-4">No recent orders.</p>}
          </div>
        </div>

        {/* TOP MARKETS */}
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-5 text-slate-900 dark:text-white tracking-tight">Top Markets by Open Interest</h3>
          <div className="space-y-1">
            {dashboardStats.topMarkets.slice(0, 8).map((market, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/50 px-3 rounded transition-colors group cursor-pointer" onClick={() => onNavigateAsset(market.id)}>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono w-4">{i + 1}</span>
                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
                      <AssetIcon assetId={market.id} isDark={isDark} size="14px" />
                  </div>
                  <div><p className="text-[11px] font-semibold tracking-tight text-slate-700 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition-colors">{market.name.replace('_', '/').toUpperCase()}</p><p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">Price: {formatCurrency(market.price)}</p></div>
                </div>
                <div className="text-right"><p className="text-[11px] font-mono text-slate-900 dark:text-white">{formatCurrency(market.oiUSD)}</p><p className="text-[9px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">Total OI</p></div>
              </div>
            ))}
          </div>
        </div>
        
        {/* TOP TRADERS */}
        <div className="bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/30">
                {[
                    { id: 'vol', label: 'By Volume' },
                    { id: 'pnl', label: 'By PnL' },
                    { id: 'active', label: 'Most Active' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setTraderTab(tab.id as any)} className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${traderTab === tab.id ? 'text-slate-900 border-slate-900 dark:text-white dark:border-white bg-white dark:bg-zinc-900/50' : 'text-slate-500 dark:text-zinc-500 border-transparent hover:text-slate-700 dark:hover:text-zinc-300'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="p-3 space-y-1 flex-1">
                {(traderTab === 'vol' ? topTradersVol.slice(0, 8) : traderTab === 'pnl' ? topTradersPnl.slice(0, 8) : topTradersActive.slice(0, 8)).map((trader: any, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/50 px-3 rounded transition-colors cursor-pointer group" onClick={() => onNavigateTrader(trader.trader)}>
                        <div className="flex items-center gap-4">
                            <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono w-4">{i + 1}</span>
                            <Wallet size={14} className="text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors" />
                            <div><p className="text-[11px] font-mono text-slate-600 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{trader.trader.substring(0, 6)}...{trader.trader.substring(trader.trader.length - 4)}</p></div>
                        </div>
                        <div className="text-right">
                            {traderTab === 'vol' && <><p className="text-[11px] font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(trader.totalVolume || 0))}</p><p className="text-[9px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">Volume</p></>}
                            {traderTab === 'pnl' && <><p className={`text-[11px] font-mono ${trader.totalPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>{trader.totalPnl >= 0 ? '+' : ''}{formatCurrency(formatE6(trader.totalPnl || 0))}</p><p className="text-[9px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">Realized PnL</p></>}
                            {traderTab === 'active' && <><p className="text-[11px] font-mono text-slate-900 dark:text-white">{trader.count} Trades</p><p className="text-[9px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">Open Count</p></>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// VUE 2 : TRADER EXPLORER
// ============================================================================
function TraderExplorerView({ address, wsData }: { address: string, wsData: any }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [rawTrades, setRawTrades] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"open" | "pending" | "closed" | "cancelled">("open");
    const [traderMetrics, setTraderMetrics] = useState<{pnl: number, vol: number}>({pnl: 0, vol: 0});

    useEffect(() => {
        const fetchTraderData = async () => {
            setIsLoading(true);
            try {
                fetch(`https://api.brokex.trade/metrics/trader/${address}`).then(r=>r.json()).then(d => {
                    if(d.success) setTraderMetrics({ pnl: formatE6(d.metrics.totalPnl), vol: formatE6(d.metrics.totalVolume) });
                }).catch(()=>{});

                const resIds = await fetch(`https://api.brokex.trade/trader/${address}/ids?state=all`);
                const { ids } = await resIds.json();
                if (!ids) return;
                
                const detailPromises = ids.slice(0, 150).map((id: number) => fetch(`https://api.brokex.trade/trade/${id}`).then(r => r.json()));
                const trades = await Promise.all(detailPromises);
                setRawTrades(trades.filter(t => !t.error));
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        fetchTraderData();
    }, [address]);

    const { open, pending, closed, cancelled, totalUnrealizedPnl } = useMemo(() => {
        const o: any[] = []; const p: any[] = []; const c: any[] = []; const ca: any[] = [];
        let totalUnrealized = 0;

        const getAssetWsPrice = (assetId: number) => {
            const categories = getAssetsByCategory(wsData);
            const match = Object.values(categories).flat().find(a => a.id === assetId);
            return match && match.currentPrice ? parseFloat(match.currentPrice) : 0;
        };

        rawTrades.forEach((t) => {
            const assetMultiplier = ASSET_LOT_SIZES[t.assetId] || 1;
            const size = (t.lotSize - (t.closedLotSize || 0)) * assetMultiplier;
            const entryP = formatE6(t.openPrice);
            const wsPrice = getAssetWsPrice(t.assetId);

            let pnl = 0;
            if (t.state === 1 && wsPrice > 0) {
                pnl = size * (wsPrice - entryP) * (t.isLong ? 1 : -1);
                totalUnrealized += pnl; // Somme des PnL ouverts
            } else if (t.state === 2) {
                const closeSize = (t.closedLotSize || t.lotSize) * assetMultiplier;
                pnl = closeSize * (formatE6(t.closePrice) - entryP) * (t.isLong ? 1 : -1);
            }

            const enriched = { ...t, displaySize: size, pnl, currentPrice: wsPrice };

            if (t.state === 1) o.push(enriched);
            else if (t.state === 0) p.push(enriched);
            else if (t.state === 2) c.push(enriched);
            else if (t.state === 3) ca.push(enriched);
        });

        const sortByDate = (arr: any[]) => arr.sort((a, b) => b.openTimestamp - a.openTimestamp);
        return { open: sortByDate(o), pending: sortByDate(p), closed: sortByDate(c), cancelled: sortByDate(ca), totalUnrealizedPnl: totalUnrealized };
    }, [rawTrades, wsData]);

    const currentData = activeTab === "open" ? open : activeTab === "pending" ? pending : activeTab === "closed" ? closed : cancelled;

    return (
        <div className="w-full bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden min-h-[500px]">
            {/* EN-TETE TRADER AVEC METRIQUES */}
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-zinc-400"><User size={24} /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Trader Profile</h2>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 font-mono mt-1 break-all">{address}</p>
                    </div>
                </div>
                <div className="flex gap-8">
                    <div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Unrealized PnL</p>
                        <p className={`text-xl font-mono font-bold ${totalUnrealizedPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                            {totalUnrealizedPnl >= 0 ? '+' : ''}{formatUSDExact(totalUnrealizedPnl)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Realized PnL</p>
                        <p className={`text-xl font-mono font-bold ${traderMetrics.pnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                            {traderMetrics.pnl >= 0 ? '+' : ''}{formatUSDExact(traderMetrics.pnl)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Volume</p>
                        <p className="text-xl font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(traderMetrics.vol)}</p>
                    </div>
                </div>
            </div>

            {/* STICKY TABS */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800/60 bg-slate-100 dark:bg-zinc-950/30 sticky top-0 z-10">
                {[
                    { id: 'open', label: `Open Positions (${open.length})` },
                    { id: 'pending', label: `Pending (${pending.length})` },
                    { id: 'closed', label: `Closed (${closed.length})` },
                    { id: 'cancelled', label: `Cancelled (${cancelled.length})` }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab.id ? 'text-slate-900 border-slate-900 bg-white dark:text-white dark:border-white dark:bg-zinc-900/50' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-200/50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900/30'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* TABLEAU */}
            <div className="overflow-x-auto">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500 dark:text-zinc-500 font-mono text-sm">Fetching trader history...</div>
                ) : currentData.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 dark:text-zinc-600 font-mono text-sm">No trades found in this category.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800/60">
                            <tr>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Asset</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Date</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Side</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Size</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Entry</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Margin</th>
                                {(activeTab === 'open' || activeTab === 'closed') && <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-right">PnL</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                            {currentData.map(trade => (
                                <tr key={trade.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors">
                                    <td className="px-6 py-3 font-semibold text-[11px] text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                        <AssetIcon assetId={trade.assetId} isDark={isDark} size="14px" />
                                        {getDisplaySymbol(trade.assetId)}
                                    </td>
                                    <td className="px-6 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-500">{format(new Date(trade.openTimestamp * 1000), "MMM dd, HH:mm")}</td>
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
                )}
            </div>
        </div>
    );
}

// ============================================================================
// VUE 3 : ASSET EXPLORER (Sans Background coloré)
// ============================================================================
function AssetExplorerView({ assetId, wsData }: { assetId: number, wsData: any }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [stats, setStats] = useState<any>(null);
    const [exposure, setExposure] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAssetData = async () => {
            setIsLoading(true);
            try {
                const [tradesRes, expRes] = await Promise.all([
                    fetch('https://api.brokex.trade/stats/open-trades'),
                    fetch('https://api.brokex.trade/exposures')
                ]);
                const tData = await tradesRes.json();
                const eData = await expRes.json();
                
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
            } catch (e) { console.error(e); } finally { setIsLoading(false); }
        };
        fetchAssetData();
    }, [assetId]);

    const metrics = useMemo(() => {
        if (!exposure || !stats) return null;
        
        const lotSize = ASSET_LOT_SIZES[assetId] || 1;
        const longLots = Number(exposure.longLots) || 0;
        const shortLots = Number(exposure.shortLots) || 0;

        const avgLongPrice = longLots > 0 ? (formatE6(exposure.longValueSum) / (longLots * lotSize)) : 0;
        const avgShortPrice = shortLots > 0 ? (formatE6(exposure.shortValueSum) / (shortLots * lotSize)) : 0;

        const categories = getAssetsByCategory(wsData);
        const match = Object.values(categories).flat().find(a => a.id === assetId);
        const currentPrice = match && match.currentPrice ? parseFloat(match.currentPrice) : 0;

        const longPnl = longLots > 0 ? (currentPrice - avgLongPrice) * (longLots * lotSize) : 0;
        const shortPnl = shortLots > 0 ? (avgShortPrice - currentPrice) * (shortLots * lotSize) : 0;

        const totalLots = longLots + shortLots;
        const longLotsPercent = totalLots > 0 ? (longLots / totalLots) * 100 : 50;
        const shortLotsPercent = totalLots > 0 ? (shortLots / totalLots) * 100 : 50;

        return { 
            avgLongPrice, avgShortPrice, currentPrice, longPnl, shortPnl, 
            totalPnl: longPnl + shortPnl, longLots, shortLots, longLotsPercent, shortLotsPercent 
        };
    }, [exposure, stats, wsData, assetId]);

    if (isLoading) return <div className="p-12 text-center text-slate-500 font-mono text-sm w-full">Loading market data...</div>;
    if (!exposure || (!exposure.longLots && !exposure.shortLots)) return <div className="p-12 text-center text-slate-500 font-mono text-sm w-full">No active exposure for this asset.</div>;

    const symbol = getDisplaySymbol(assetId);

    return (
        <div className="w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm">
            {/* EN-TETE ACTIF */}
            <div className="p-8 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-xl">
                        <AssetIcon assetId={assetId} isDark={isDark} size="28px" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{symbol} Market Data</h2>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 font-mono mt-1">Real-time exposure and global PnL analysis.</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Mark Price</p>
                    <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{metrics?.currentPrice ? formatUSDExact(metrics.currentPrice) : '---'}</p>
                </div>
            </div>

            {/* RÉSUMÉ GLOBAL (Lots & PnL) */}
            <div className="p-6 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-950/20">
                <h3 className="text-sm font-semibold mb-4 text-slate-900 dark:text-white">Market Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Global Unrealized PnL</p>
                        <p className={`text-2xl font-mono font-bold ${metrics!.totalPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                            {metrics!.totalPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.totalPnl)}
                        </p>
                    </div>
                    <div className="col-span-2 flex flex-col justify-center">
                        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2 flex justify-between">
                            <span>Long Exposure: {metrics!.longLots} Lots</span>
                            <span>Short Exposure: {metrics!.shortLots} Lots</span>
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
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Open Positions</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{stats.long.openCount} <span className="text-xs text-slate-400 dark:text-zinc-500">(~{stats.long.avgLeverage.toFixed(1)}x avg)</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Lots Exposure</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{metrics!.longLots} Lots</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Avg Entry Price</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatUSDExact(metrics!.avgLongPrice)}</p>
                        </div>
                        <div></div> {/* Espacement */}
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> LP Locked (Max Profit)</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.longMaxProfit))}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Total Margin (Max Loss)</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.longMaxLoss))}</p>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Longs Unrealized PnL</p>
                        <p className={`text-xl font-mono font-bold ${metrics!.longPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                            {metrics!.longPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.longPnl)}
                        </p>
                    </div>
                </div>

                {/* SHORT COLUMN */}
                <div className="p-8 space-y-8 bg-transparent">
                    <div className="flex items-center gap-3">
                        <TrendingDown className="text-red-600 dark:text-red-500" size={24} />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Short Data</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Open Positions</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{stats.short.openCount} <span className="text-xs text-slate-400 dark:text-zinc-500">(~{stats.short.avgLeverage.toFixed(1)}x avg)</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Lots Exposure</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{metrics!.shortLots} Lots</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">Avg Entry Price</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatUSDExact(metrics!.avgShortPrice)}</p>
                        </div>
                        <div></div> {/* Espacement */}
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> LP Locked (Max Profit)</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.shortMaxProfit))}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Total Margin (Max Loss)</p>
                            <p className="text-lg font-mono text-slate-900 dark:text-white">{formatCurrency(formatE6(exposure.shortMaxLoss))}</p>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg">
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider mb-1">Shorts Unrealized PnL</p>
                        <p className={`text-xl font-mono font-bold ${metrics!.shortPnl >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
                            {metrics!.shortPnl >= 0 ? '+' : ''}{formatUSDExact(metrics!.shortPnl)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Composant utilitaire
function Metric({ title, value, sub, icon, valueColor }: { title: string, value: string, sub?: string, icon: React.ReactNode, valueColor?: string }) {
  return (
    <div className="px-5 py-4 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400 dark:text-zinc-500">{icon}</span>
        <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">{title}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-xl font-mono ${valueColor || 'text-slate-900 dark:text-white'}`}>{value}</p>
        {sub && <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">{sub}</span>}
      </div>
    </div>
  );
}
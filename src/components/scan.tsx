"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, Wallet, BarChart3, Activity, ArrowLeft, User } from 'lucide-react';
import { useWebSocket, getAssetsByCategory } from '@/hooks/useWebSocket';
import { BottomBar } from "@/components/BottomBar";
import { useTheme } from "next-themes";
import { AssetIcon } from "@/hooks/useAssetIcon"; 
import ExposureTreemap from '@/components/ExposureTreemap'; // Ajuste le chemin selon ton dossier

// --- IMPORTS DES COMPOSANTS EXTERNES ---
import TraderExplorerView from "@/components/TraderExplorerView";
import AssetExplorerView from "@/components/AssetExplorerView";

// --- CONSTANTES ---
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

const WAD = 1000000000000000000n;

// --- UTILITAIRES ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatCompact = (val: number) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(val);
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
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
                                className="flex items-center gap-3 px-4 py-2.5 text-xs font-mono cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300 uppercase transition-colors"
                            >
                                <AssetIcon assetId={pair.id} isDark={isDark} size="14px" />
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

  const [latestTrades, setLatestTrades] = useState<any[]>([]);
  const [topMarketIndex, setTopMarketIndex] = useState(0);
  const [avgFundings, setAvgFundings] = useState<any>({});
  const [liveFundings, setLiveFundings] = useState<any>({});

  useEffect(() => {
    const fetchApiData = async () => {
      try {
        // AJOUT : fetch des fundings moyens (/all)
        const [tradersRes, tradesRes, expRes, volRes, maxIdRes, avgFundRes] = await Promise.all([
          fetch('https://api.brokex.trade/stats/total-traders').catch(() => null),
          fetch('https://api.brokex.trade/stats/open-trades').catch(() => null),
          fetch('https://api.brokex.trade/exposures').catch(() => null),
          fetch('https://api.brokex.trade/stats/volume-24h').catch(() => null),
          fetch('https://api.brokex.trade/stats/max-trade-id').catch(() => null),
          fetch('https://api.brokex.trade/stats/funding/all').catch(() => null) 
        ]);

        if (tradersRes) tradersRes.json().then(d => d.success && setTotalTraders(d.totalTraders));
        if (tradesRes) tradesRes.json().then(d => d.success && setOpenTradesStats(d.data));
        if (volRes) volRes.json().then(d => d.success && setVolume24h(d.volume24h));
        
        // 1. Sauvegarde des fundings moyens
        if (avgFundRes) {
            const d = await avgFundRes.json();
            if (d.success) setAvgFundings(d.data);
        }

        // 2. Traitement des expositions et fetch FIXÉ des live fundings
        if (expRes) {
            expRes.json().then(async (d) => {
                if (d.success) {
                    setExposures(d.data);
                    
                    const activeIds = Object.keys(d.data);
                    const livePromises = activeIds.map(id => 
                        fetch(`https://api.brokex.trade/funding/live/${id}`)
                            .then(r => r.json())
                            .then(res => ({ id: Number(id), data: res.data })) // On force l'injection de l'ID ici
                            .catch(() => null)
                    );
                    const liveResults = await Promise.all(livePromises);
                    
                    const liveMap: any = {};
                    liveResults.forEach(item => {
                        if (item && item.data) {
                            liveMap[item.id] = item.data;
                        }
                    });
                    setLiveFundings(liveMap);
                }
            });
        }

        if (maxIdRes) {
            const data = await maxIdRes.json();
            if (data.success && data.maxId) {
                const maxId = data.maxId;
                const tradePromises = [];
                for (let i = 0; i < 15; i++) {
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

  // --- LE CALCUL GLOBAL DU DASHBOARD (Avec Funding PnL !) ---
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
          // 1. Calcul du PnL Brut
          const rawLongPnl = longLots > 0 ? (price - avgLongPrice) * (longLots * lotSize) : 0;
          const rawShortPnl = shortLots > 0 ? (avgShortPrice - price) * (shortLots * lotSize) : 0;

          // 2. Calcul du Funding Owed
          let longFundingFeeUsd = 0;
          let shortFundingFeeUsd = 0;

          const liveFunding = liveFundings[assetId] || liveFundings[assetId.toString()];
          const avgFunding = avgFundings[assetId] || avgFundings[assetId.toString()];

          if (liveFunding && avgFunding) {
              const liveLong = BigInt(liveFunding.liveLongIndex || "0");
              const liveShort = BigInt(liveFunding.liveShortIndex || "0");
              const avgLongIdx = BigInt(avgFunding.longAvgFundingIndex || "0");
              const avgShortIdx = BigInt(avgFunding.shortAvgFundingIndex || "0");

              // Différence d'index rapportée à la taille totale en USD
              const deltaLong = Number(liveLong - avgLongIdx) / Number(WAD);
              longFundingFeeUsd = deltaLong * assetLongUSD;

              const deltaShort = Number(liveShort - avgShortIdx) / Number(WAD);
              shortFundingFeeUsd = deltaShort * assetShortUSD;
          }

          // 3. Déduction du Funding sur le PnL global
          globalUnrealizedPnl += (rawLongPnl - longFundingFeeUsd);
          globalUnrealizedPnl += (rawShortPnl - shortFundingFeeUsd);
      }

      if (assetLongUSD > 0 || assetShortUSD > 0) {
        marketsArray.push({ 
            id: assetId, name: exp.name, oiUSD: assetLongUSD + assetShortUSD, price: price,
            longsUSD: assetLongUSD, shortsUSD: assetShortUSD,
            maxLossUSD: formatE6(exp.longMaxLoss) + formatE6(exp.shortMaxLoss),
            maxProfitUSD: formatE6(exp.longMaxProfit) + formatE6(exp.shortMaxProfit),
        });
      }
    });

    marketsArray.sort((a, b) => b.oiUSD - a.oiUSD);
    const totalOI = longExpUSD + shortExpUSD;
    const longPercent = totalOI > 0 ? Math.round((longExpUSD / totalOI) * 100) : 50;
    const shortPercent = totalOI > 0 ? 100 - longPercent : 50;

    return { 
        longExpUSD, shortExpUSD, longCount, shortCount, totalPositions, 
        avgLev, totalOI, longPercent, shortPercent, globalUnrealizedPnl, 
        topMarkets: marketsArray 
    };
  }, [openTradesStats, exposures, currentPrices, avgFundings, liveFundings]);

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
                      <p className="text-slate-900 dark:text-white font-mono text-sm">{formatDynamicPrice(currentTopMarketCarousel.price)}</p>
                  </div>
              </div>
          ) : (<p className="text-xs text-slate-500 dark:text-zinc-600 font-mono">Loading data...</p>)}
        </div>
      </div>

      {/* ROW 3: LISTS (1/3 et 2/3) AVEC SCROLL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
        
        {/* LATEST ORDERS (Scrollable) */}
        <div className="lg:col-span-1 bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Latest Orders</h3>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {latestTrades.map((trade, i) => {
                const isClose = trade.state === 2 || trade.state === 3;
                const notionalUsd = formatE6(trade.marginUsdc) * trade.leverage;
                
                return (
                  <div key={trade.id || i} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-zinc-900/50 rounded transition-colors cursor-pointer group" onClick={() => onNavigateTrader(trade.trader)}>
                      <div className="flex items-center gap-3">
                          <div className="w-6 h-6 flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
                              <AssetIcon assetId={trade.assetId} isDark={isDark} size="14px" />
                          </div>
                          <div>
                              <p className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                  {isClose ? 'Close' : 'Open'} <span className="font-bold">{getDisplaySymbol(trade.assetId).replace('/USD', '')}</span> <span className={trade.isLong ? 'text-blue-500' : 'text-red-500'}>{trade.isLong ? 'Long' : 'Short'}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono mt-0.5">
                                  {trade.trader.substring(0, 6)}...{trade.trader.substring(trade.trader.length - 4)}
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
          </div>
        </div>

        {/* TOP MARKETS (Scrollable max 15 éléments visibles puis scroll) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-lg overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-zinc-950/30">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Top Markets by Open Interest</h3>
            </div>
            
            <div className="overflow-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left border-collapse relative">
                    <thead className="bg-slate-50/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800/50 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Market</th>
                            <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Price</th>
                            <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-center">Long / Short Ratio</th>
                            <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-right">Margin / LP Locked</th>
                            <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-right">Total OI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                        {dashboardStats.topMarkets.slice(0, 15).map((market, i) => { // Limitation à 15 éléments
                            const lPct = market.oiUSD > 0 ? Math.round((market.longsUSD / market.oiUSD) * 100) : 50;
                            const sPct = market.oiUSD > 0 ? 100 - lPct : 50;
                            
                            return (
                                <tr key={market.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer group" onClick={() => onNavigateAsset(market.id)}>
                                    <td className="px-6 py-3.5 flex items-center gap-3">
                                        <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono w-4">#{i + 1}</span>
                                        <div className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center">
                                            <AssetIcon assetId={market.id} isDark={isDark} size="16px" />
                                        </div>
                                        <span className="text-xs font-bold tracking-tight text-slate-700 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition-colors">{market.name.replace('_', '/').toUpperCase()}</span>
                                    </td>
                                    <td className="px-6 py-3.5 text-[11px] font-mono text-slate-700 dark:text-zinc-300">
                                        {formatDynamicPrice(market.price)}
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex flex-col items-center gap-1 w-full max-w-[120px] mx-auto">
                                            <div className="w-full flex justify-between text-[9px] font-mono font-bold">
                                                <span className="text-blue-500">{lPct}%</span><span className="text-red-500">{sPct}%</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full flex overflow-hidden bg-slate-200 dark:bg-zinc-800">
                                                <div className="h-full bg-blue-500" style={{ width: `${lPct}%` }}></div>
                                                <div className="h-full bg-red-500" style={{ width: `${sPct}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <p className="text-[11px] font-mono text-slate-900 dark:text-white">{formatCompact(market.maxLossUSD)}</p>
                                        <p className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">{formatCompact(market.maxProfitUSD)}</p>
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <p className="text-[11px] font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(market.oiUSD)}</p>
                                    </td>
                                </tr>
                            )
                        })}
                        {dashboardStats.topMarkets.length === 0 && (
                            <tr><td colSpan={5} className="py-12 text-center text-slate-500 dark:text-zinc-600 font-mono text-xs">No active markets.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        

      </div>
      <ExposureTreemap 
    exposures={exposures} 
    currentPrices={currentPrices} 
    onNavigateAsset={onNavigateAsset} 
/>
    </>
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
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, TrendingUp, Wallet, ArrowLeft, Target, Trophy, Share2, Loader2 } from 'lucide-react';
import { useWebSocket, getAssetsByCategory } from '@/hooks/useWebSocket';
import { useAccount } from 'wagmi';
import TraderExplorerView from "@/components/TraderExplorerView";

// --- MAPPING POUR LE CALCUL NON RÉALISÉ ---
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.1, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export const LeaderboardMobile = () => {
  const { address: connectedAddress } = useAccount();
  const { data: wsData } = useWebSocket();
  
  const [view, setView] = useState<'list' | 'trader'>('list');
  const [targetTrader, setTargetTrader] = useState<string>(""); 
  const [activeTab, setActiveTab] = useState<'pnl' | 'volume' | 'trades'>('pnl');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userRanks, setUserRanks] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States pour la capture d'écran
  const [isSharing, setIsSharing] = useState(false);
  const [unrealizedForShare, setUnrealizedForShare] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBoard = async () => {
      setLoading(true);
      try {
        const res = await fetch('https://api.brokex.trade/traders/leaderboard');
        const json = await res.json();
        if (json.success) setLeaderboardData(json);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchBoard();
  }, []);

  useEffect(() => {
    const fetchUserRanks = async () => {
      const addr = connectedAddress; 
      if (!addr) return;
      try {
        const res = await fetch(`https://api.brokex.trade/trader/${addr}/ranks`);
        const json = await res.json();
        if (json.success) setUserRanks(json.ranks);
      } catch (e) { console.error(e); }
    };
    fetchUserRanks();
  }, [connectedAddress]);

  const currentList = useMemo(() => {
    if (!leaderboardData) return [];
    if (activeTab === 'pnl') return leaderboardData.topByPnl;
    if (activeTab === 'volume') return leaderboardData.topByVolume;
    return leaderboardData.topByTrades;
  }, [leaderboardData, activeTab]);

  const filteredList = useMemo(() => {
    if (!searchQuery) return currentList;
    return currentList.filter((t: any) => t.trader.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [currentList, searchQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (query.startsWith('0x') && query.length > 10) {
      setTargetTrader(query);
      setView('trader');
    } else {
      alert("Invalid format. Please enter a valid Wallet Address.");
    }
  };

  const handleTraderClick = (addr: string) => {
      setTargetTrader(addr);
      setView('trader');
  };

  // --- LOGIQUE DE PARTAGE ---
  const handleShareStats = async () => {
    if (!connectedAddress || !userRanks) return;
    setIsSharing(true);

    try {
        const resIds = await fetch(`https://api.brokex.trade/trader/${connectedAddress}/ids?state=open`);
        const { ids } = await resIds.json();
        
        let totalUnrealized = 0;
        if (ids && ids.length > 0) {
            const detailPromises = ids.map((id: number) => fetch(`https://api.brokex.trade/trade/${id}`).then(r => r.json()));
            const trades = await Promise.all(detailPromises);
            
            trades.filter(t => !t.error).forEach(t => {
                const assetMultiplier = ASSET_LOT_SIZES[t.assetId] || 1;
                const size = (t.lotSize - (t.closedLotSize || 0)) * assetMultiplier;
                const entryP = formatE6(t.openPrice);
                
                const categories = getAssetsByCategory(wsData || {});
                const match = Object.values(categories).flat().find((a: any) => a.id === t.assetId);
                const wsPrice = match && match.currentPrice ? parseFloat(match.currentPrice) : 0;

                if (wsPrice > 0) {
                    totalUnrealized += size * (wsPrice - entryP) * (t.isLong ? 1 : -1);
                }
            });
        }
        setUnrealizedForShare(totalUnrealized);

        await new Promise(resolve => setTimeout(resolve, 100));

        const html2canvas = (await import('html2canvas')).default;

        if (!printRef.current) return;
        const canvas = await html2canvas(printRef.current, { 
            backgroundColor: '#0a0a0a',
            scale: 2, 
            useCORS: true
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Erreur de génération d'image");
        const file = new File([blob], 'brokex-stats.png', { type: 'image/png' });

        const shareText = `Check out my trading stats on Brokex! 🏆\n\n📈 Rank: #${userRanks.pnl.rank}\n💰 Realized PnL: $${formatCurrency(formatE6(userRanks.pnl.value))}\n\nTrade now on Brokex! #Crypto #Trading #DeFi`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'My Brokex Stats',
                text: shareText,
                files: [file]
            });
        } else {
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = 'brokex-stats.png';
            a.click();
            
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(tweetUrl, '_blank');
        }
    } catch (err) {
        console.error("Share error:", err);
        alert("Failed to generate image.");
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#0a0a0a] text-slate-900 dark:text-white font-sans transition-colors overflow-hidden">
      
      {/* HEADER ÉPURÉ */}
      <div className="flex-none px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          {view === 'trader' ? (
             <button onClick={() => { setView('list'); setSearchQuery(""); }} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors">
                 <ArrowLeft size={22} className="text-slate-900 dark:text-white" />
             </button>
          ) : (
             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 flex items-center justify-center shadow-sm">
                <Trophy size={18} className="text-slate-900 dark:text-white" />
             </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                {view === 'trader' ? 'Trader Profile' : 'Hall of Fame'}
            </h1>
            {view === 'list' && <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Top traders on the platform.</p>}
          </div>
        </div>

        {view === 'list' && (
            <form onSubmit={handleSearch} className="relative w-full mt-2">
                <div className="flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all h-12 shadow-sm">
                    <div className="pl-4 pr-2 text-slate-400 dark:text-zinc-500">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search Address 0x..."
                        className="flex-1 bg-transparent pr-4 text-sm font-mono outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </form>
        )}
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {view === 'list' ? (
              <div className="flex flex-col">
                  
                  {/* USER RANKS (Si connecté) - STYLE "TOKEN SALE" CARD */}
                  {userRanks && (
                      <div className="mx-5 mb-6 bg-white dark:bg-[#111] rounded-[20px] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                          <div className="flex divide-x divide-slate-100 dark:divide-zinc-800/60 p-5">
                              <RankMiniCard title="PnL Rank" rank={userRanks.pnl.rank} value={formatCurrency(formatE6(userRanks.pnl.value))} isPnl />
                              <RankMiniCard title="Volume Rank" rank={userRanks.volume.rank} value={formatCurrency(formatE6(userRanks.volume.value))} />
                          </div>
                          <div className="px-5 pb-5">
                            <button 
                                onClick={handleShareStats} 
                                disabled={isSharing}
                                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-[#1c1c1e] hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-70"
                            >
                                {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                                {isSharing ? 'Generating Image...' : 'Share My Stats'}
                            </button>
                          </div>
                      </div>
                  )}

                  {/* TABS (STYLE PILL TOGGLE) */}
                  <div className="mx-5 mb-4 flex bg-slate-100 dark:bg-[#1c1c1e] p-1 rounded-full sticky top-0 z-10">
                    <TabButton active={activeTab === 'pnl'} onClick={() => setActiveTab('pnl')} label="PnL" />
                    <TabButton active={activeTab === 'volume'} onClick={() => setActiveTab('volume')} label="Volume" />
                    <TabButton active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Trades" />
                  </div>

                  {/* LISTE */}
                  <div className="flex flex-col px-5 pb-8">
                    {loading ? (
                        <div className="py-10 flex justify-center">
                            <Loader2 size={24} className="animate-spin text-slate-300 dark:text-zinc-700" />
                        </div>
                    ) : filteredList.map((t: any, i: number) => {
                        const val = activeTab === 'pnl' ? t.pnl : activeTab === 'volume' ? t.volume : t.totalTrades;
                        const isPositive = typeof val === 'number' && val >= 0;

                        const pnlColorClass = activeTab === 'pnl' 
                            ? (isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400') 
                            : 'text-slate-900 dark:text-white';

                        return (
                            <div 
                                key={t.trader} 
                                onClick={() => handleTraderClick(t.trader)}
                                className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-zinc-800/60 border-dashed last:border-0 active:opacity-60 transition-opacity cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-6 text-sm font-bold text-slate-400 dark:text-zinc-600">
                                        #{i + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                                {shortenAddress(t.trader)}
                                            </span>
                                            {connectedAddress?.toLowerCase() === t.trader.toLowerCase() && (
                                                <span className="px-1.5 py-[2px] bg-slate-100 dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-[9px] font-bold rounded-md uppercase tracking-wide">You</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={`text-right font-mono font-bold text-sm ${pnlColorClass}`}>
                                    {activeTab === 'trades' ? val : (activeTab === 'pnl' ? (isPositive ? '+' : '') + formatUSDExact(formatE6(val)) : formatCurrency(formatE6(val)))}
                                </div>
                            </div>
                        );
                    })}
                  </div>
              </div>
          ) : (
              <TraderExplorerView address={targetTrader} wsData={wsData} />
          )}
      </div>

      {/* ========================================================================= */}
      {/* CARTE CACHÉE POUR LA GÉNÉRATION DE L'IMAGE (INCHANGÉE)                    */}
      {/* ========================================================================= */}
      {userRanks && connectedAddress && (
        <div className="fixed top-[-9999px] left-[-9999px]">
            <div ref={printRef} className="w-[600px] h-[750px] bg-[#0a0a0a] border-4 border-zinc-800 p-10 flex flex-col justify-between font-sans text-white relative overflow-hidden">
                <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
                <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-amber-500 rounded-full blur-[120px] opacity-10 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-12">
                        <h1 className="text-4xl font-black tracking-tighter text-white">BROKEX</h1>
                        <span className="px-4 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-mono uppercase tracking-widest rounded-md">Trader Profile</span>
                    </div>

                    <div className="mb-12">
                        <p className="text-zinc-500 text-lg uppercase font-bold tracking-widest mb-2">Wallet</p>
                        <p className="text-5xl font-mono font-bold text-blue-500">{shortenAddress(connectedAddress)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-12">
                        <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6">
                            <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest mb-3">Realized PnL</p>
                            <p className={`text-4xl font-mono font-bold ${formatE6(userRanks.pnl.value) >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {formatE6(userRanks.pnl.value) >= 0 ? '+' : ''}{formatUSDExact(formatE6(userRanks.pnl.value))}
                            </p>
                            <p className="text-zinc-400 font-mono mt-2 text-sm">Rank: #{userRanks.pnl.rank}</p>
                        </div>
                        
                        <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6">
                            <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest mb-3">Unrealized PnL</p>
                            <p className={`text-4xl font-mono font-bold ${unrealizedForShare >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                {unrealizedForShare >= 0 ? '+' : ''}{formatUSDExact(unrealizedForShare)}
                            </p>
                            <p className="text-zinc-400 font-mono mt-2 text-sm">Live Status</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest mb-2">Total Volume</p>
                            <p className="text-3xl font-mono font-bold text-white">{formatCurrency(formatE6(userRanks.volume.value))}</p>
                        </div>
                        <div>
                            <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest mb-2">Total Trades</p>
                            <p className="text-3xl font-mono font-bold text-white">{userRanks.activity.value}</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 border-t border-zinc-800 pt-6 mt-auto">
                    <p className="text-center text-zinc-500 font-mono text-sm">Generated on brokex.trade • {new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- COMPOSANTS UI ADAPTÉS À LA NOUVELLE DA ---

function RankMiniCard({ title, rank, value, isPnl }: any) {
  const isPositive = !isPnl || !value.includes('-');
  
  const valueColor = isPnl 
    ? (isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400') 
    : 'text-slate-500 dark:text-zinc-400';

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1">
        {title}
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white">#{rank}</div>
      <div className={`text-xs font-mono font-medium mt-1 ${valueColor}`}>
          {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
        active 
          ? 'bg-white dark:bg-[#0a0a0a] shadow-sm text-slate-900 dark:text-white' 
          : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );
}
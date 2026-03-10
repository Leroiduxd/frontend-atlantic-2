"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft, Trophy, Share2, Loader2 } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
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
  
  // 🛑 NOUVEAU: Ajout de l'onglet 'points' par défaut
  const [activeTab, setActiveTab] = useState<'points' | 'pnl' | 'volume' | 'trades'>('points');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userRanks, setUserRanks] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States pour la capture d'écran
  const [isSharing, setIsSharing] = useState(false);

  // --- FETCHING DES CLASSEMENTS ---
  useEffect(() => {
    const fetchBoard = async () => {
      setLoading(true);
      try {
        const [resBoard, resPoints] = await Promise.all([
          fetch('https://api.brokex.trade/traders/leaderboard').then(r => r.json()),
          fetch('https://api.brokex.trade/traders/points').then(r => r.json())
        ]);
        
        if (resBoard.success) {
          setLeaderboardData({
            ...resBoard,
            topByPoints: resPoints.success ? resPoints.data : []
          });
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchBoard();
  }, []);

  // --- FETCHING DES RANGS UTILISATEUR ---
  useEffect(() => {
    const fetchUserRanks = async () => {
      const addr = connectedAddress; 
      if (!addr) return;
      try {
        const [resRanks, resPoints] = await Promise.all([
          fetch(`https://api.brokex.trade/trader/${addr}/ranks`).then(r => r.json()),
          fetch(`https://api.brokex.trade/trader/${addr}/points`).then(r => r.json())
        ]);
        
        setUserRanks({
          ...(resRanks.success ? resRanks.ranks : {}),
          pointsData: resPoints.success ? resPoints : null
        });
      } catch (e) { console.error(e); }
    };
    fetchUserRanks();
  }, [connectedAddress]);

  const currentList = useMemo(() => {
    if (!leaderboardData) return [];
    if (activeTab === 'points') return leaderboardData.topByPoints;
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

  // --- LOGIQUE DE PARTAGE SUR X ---
  const handleShareStats = async () => {
    if (!connectedAddress || !userRanks) return;
    setIsSharing(true);

    try {
        const response = await fetch(`https://api.brokex.trade/trader/${connectedAddress}/card.png`);
        if (!response.ok) throw new Error("Failed to fetch share image");
        
        const blob = await response.blob();
        const file = new File([blob], 'brokex-stats.png', { type: blob.type || 'image/png' });

        // 🛑 NOUVEAU: Le texte inclut le classement en Points s'il existe
        const pointsRankText = userRanks.pointsData?.rank ? `🏆 Points Rank: #${userRanks.pointsData.rank}\n` : '';
        const shareText = `Check out my trading stats on Brokex! 🚀\n\n${pointsRankText}📈 PnL Rank: #${userRanks.pnl?.rank || '-'}\n💰 Realized PnL: $${formatCurrency(formatE6(userRanks.pnl?.value || 0))}\n\nTrade now on Brokex! #Crypto #Trading #DeFi`;

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'My Brokex Stats',
                text: shareText,
                files: [file]
            });
        } else {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'brokex-stats.png';
            a.click();
            window.URL.revokeObjectURL(url);
            
            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
            window.open(tweetUrl, '_blank');
        }
    } catch (err) {
        console.error("Share error:", err);
        alert("Failed to fetch or share image.");
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
                  
                  {/* USER RANKS (Si connecté) - 3 COLONNES DÉSORMAIS */}
                  {userRanks && (
                      <div className="mx-5 mb-6 bg-white dark:bg-[#111] rounded-[20px] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                          <div className="flex divide-x divide-slate-100 dark:divide-zinc-800/60 p-4">
                              <RankMiniCard title="Points Rank" rank={userRanks.pointsData?.rank || '-'} value={`${userRanks.pointsData?.points?.toFixed(2) || '0'} PTS`} />
                              <RankMiniCard title="PnL Rank" rank={userRanks.pnl?.rank || '-'} value={formatCurrency(formatE6(userRanks.pnl?.value || 0))} isPnl />
                              <RankMiniCard title="Volume Rank" rank={userRanks.volume?.rank || '-'} value={formatCurrency(formatE6(userRanks.volume?.value || 0))} />
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

                  {/* TABS (Ajout de "Points" au début, avec un petit overflow pour scroll si besoin) */}
                  <div className="mx-5 mb-4 flex bg-slate-100 dark:bg-[#1c1c1e] p-1 rounded-full sticky top-0 z-10 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
                    <TabButton active={activeTab === 'points'} onClick={() => setActiveTab('points')} label="Points" />
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
                        const val = activeTab === 'points' ? t.points : activeTab === 'pnl' ? t.pnl : activeTab === 'volume' ? t.volume : t.totalTrades;
                        const isPositive = typeof val === 'number' && val >= 0;

                        // Gestion des couleurs
                        let pnlColorClass = 'text-slate-900 dark:text-white';
                        if (activeTab === 'pnl') pnlColorClass = isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';

                        // Gestion du formattage
                        let displayValue = '';
                        if (activeTab === 'points') displayValue = `${val.toFixed(2)} PTS`;
                        else if (activeTab === 'trades') displayValue = val.toString();
                        else if (activeTab === 'pnl') displayValue = (isPositive ? '+' : '') + formatUSDExact(formatE6(val));
                        else displayValue = formatCurrency(formatE6(val));

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
                                    {displayValue}
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
    <div className="flex-1 flex flex-col items-center justify-center text-center overflow-hidden px-1">
      <div className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1 w-full truncate">
        {title}
      </div>
      <div className="text-xl font-black text-slate-900 dark:text-white">#{rank}</div>
      <div className={`text-[10px] font-mono font-medium mt-1 w-full truncate ${valueColor}`}>
          {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-2 px-3 whitespace-nowrap text-sm font-semibold rounded-full transition-all duration-200 ${
        active 
          ? 'bg-white dark:bg-[#0a0a0a] shadow-sm text-slate-900 dark:text-white' 
          : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );
}
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, Wallet, ArrowLeft, Target, Award, Share2, Loader2, ListFilter } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { BottomBar } from "@/components/BottomBar";
import { useAccount } from 'wagmi';

// IMPORT DU NOUVEAU COMPOSANT
import TraderExplorerView from "@/components/TraderExplorerView";

// --- UTILITAIRES ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export default function Leaderboard() {
  const { address: connectedAddress } = useAccount();
  const { data: wsData } = useWebSocket();
  const [currentAssetId, setCurrentAssetId] = useState<number>(0);
  
  const [view, setView] = useState<'list' | 'trader'>('list');
  const [targetTrader, setTargetTrader] = useState<string>(""); 
  
  const [activeTab, setActiveTab] = useState<'points' | 'pnl' | 'volume' | 'trades'>('points');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userRanks, setUserRanks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

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

  const handleShareStats = async () => {
    if (!connectedAddress || !userRanks) return;
    setIsSharing(true);

    try {
        const imageUrl = `https://api.brokex.trade/trader/${connectedAddress}/card.png`;
        const pointsRankText = userRanks.pointsData?.rank ? `🏆 Points Rank: #${userRanks.pointsData.rank}\n` : '';
        const shareText = `Check out my trading stats on Brokex! 🚀\n\n${pointsRankText}📈 PnL Rank: #${userRanks.pnl?.rank || '-'}\n💰 Realized PnL: $${formatCurrency(formatE6(userRanks.pnl?.value || 0))}\n\nExplore my profile: ${imageUrl}\n\nTrade now on @brokexfi ! #Crypto #Trading #DeFi`;

        const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(tweetUrl, '_blank', 'width=550,height=420');
    } catch (err) {
        console.error("Share error:", err);
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 overflow-y-auto pb-[60px] transition-colors duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      <div className="w-full flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-zinc-800/50 pt-12 pb-6 px-8 bg-white dark:bg-black sticky top-0 z-40 transition-colors duration-300">
        
        {/* PARTIE GAUCHE : Titre + Stats */}
        <div className="flex flex-col gap-4 mb-6 md:mb-0 w-full md:w-auto">
            <div>
                <div className="flex items-center gap-3 cursor-pointer group w-fit" onClick={() => { setView('list'); setSearchQuery(""); }}>
                    {view === 'trader' && <ArrowLeft size={20} className="text-slate-400 dark:text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors" />}
                    <h1 className="text-2xl font-bold tracking-tight group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">Hall of Fame</h1>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-mono uppercase tracking-wider rounded">Leaderboard</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mt-1">Top traders by performance and activity.</p>
            </div>

            {userRanks && view === 'list' && (
                <div className="flex items-center gap-4 mt-2">
                    <RankMiniCard title="Points" rank={userRanks.pointsData?.rank || '-'} value={`${userRanks.pointsData?.points?.toFixed(2) || '0'} PTS`} icon={<Award size={12}/>} />
                    <RankMiniCard title="PnL" rank={userRanks.pnl?.rank || '-'} value={formatCurrency(formatE6(userRanks.pnl?.value || 0))} icon={<TrendingUp size={12}/>} isPnl />
                    <RankMiniCard title="Volume" rank={userRanks.volume?.rank || '-'} value={formatCurrency(formatE6(userRanks.volume?.value || 0))} icon={<Wallet size={12}/>} />
                    <RankMiniCard title="Activity" rank={userRanks.activity?.rank || '-'} value={`${userRanks.activity?.value || 0} trades`} icon={<Target size={12}/>} />
                </div>
            )}
        </div>
        
        {/* PARTIE DROITE : Bouton Share (Au dessus) + Recherche (En dessous) */}
        <div className="flex flex-col items-end gap-3 w-full md:w-[350px]">
            {userRanks && view === 'list' && (
                <button 
                    onClick={handleShareStats} 
                    disabled={isSharing}
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold rounded-lg transition-transform active:scale-[0.98]"
                >
                    {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                    {isSharing ? 'Sharing...' : 'Share Profile on X'}
                </button>
            )}

            <form onSubmit={handleSearch} className="relative w-full">
                <div className="relative flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-md focus-within:border-slate-400 dark:focus-within:border-zinc-500 transition-colors z-50">
                    <input
                        type="text"
                        placeholder="Search Address..."
                        className="flex-1 bg-transparent px-4 h-10 outline-none text-xs placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono text-slate-900 dark:text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="w-10 h-10 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white border-l border-slate-200 dark:border-zinc-800 rounded-r-md">
                        <Search size={14} />
                    </button>
                </div>
            </form>
        </div>
      </div>

      <div className="w-full px-8 py-8 space-y-6">
          {view === 'list' ? (
              <div className="w-full bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden min-h-[500px]">
                  
                  {/* NOUVEAU DESIGN DE FILTRE (Sélecteur Pill) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-[#0a0a0a]">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                          <ListFilter size={16} />
                          <span className="text-xs font-bold uppercase tracking-widest">Rank by:</span>
                      </div>
                      
                      <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-lg w-full sm:w-auto overflow-x-auto [&::-webkit-scrollbar]:hidden">
                        <FilterPill active={activeTab === 'points'} onClick={() => setActiveTab('points')} label="Points" />
                        <FilterPill active={activeTab === 'pnl'} onClick={() => setActiveTab('pnl')} label="PnL" />
                        <FilterPill active={activeTab === 'volume'} onClick={() => setActiveTab('volume')} label="Volume" />
                        <FilterPill active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Trades" />
                      </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800/60">
                            <tr>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 w-24">Rank</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500">Trader</th>
                                <th className="px-6 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-500 text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                            {loading ? (
                                <tr><td colSpan={3} className="p-12 text-center text-slate-500 dark:text-zinc-500 font-mono text-xs animate-pulse">Loading leaderboard...</td></tr>
                            ) : filteredList.map((t: any, i: number) => {
                                const val = activeTab === 'points' ? t.points : activeTab === 'pnl' ? t.pnl : activeTab === 'volume' ? t.volume : t.totalTrades;
                                const isPositive = typeof val === 'number' && val >= 0;

                                // Couleur de texte sobre pour les points (plus de jaune)
                                let valueColorClass = 'text-slate-900 dark:text-white font-bold';
                                if (activeTab === 'pnl') {
                                    valueColorClass = isPositive ? 'text-blue-600 dark:text-blue-500 font-bold' : 'text-red-600 dark:text-red-500 font-bold';
                                }

                                let displayValue = '';
                                if (activeTab === 'points') displayValue = `${val.toFixed(2)} PTS`;
                                else if (activeTab === 'trades') displayValue = val.toString();
                                else if (activeTab === 'pnl') displayValue = (isPositive ? '+' : '') + formatUSDExact(formatE6(val));
                                else displayValue = formatCurrency(formatE6(val));

                                return (
                                    <tr key={t.trader} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer group" onClick={() => handleTraderClick(t.trader)}>
                                        <td className="px-6 py-4">
                                            <span className={`text-[11px] font-bold ${i < 3 ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-600'}`}>#{i + 1}</span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors flex items-center gap-2">
                                            {t.trader}
                                            {connectedAddress?.toLowerCase() === t.trader.toLowerCase() && (
                                                <span className="px-1.5 py-[2px] bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[9px] font-bold rounded uppercase tracking-wide">You</span>
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-mono text-[11px] ${valueColorClass}`}>
                                            {displayValue}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                  </div>
              </div>
          ) : (
              <TraderExplorerView address={targetTrader} wsData={wsData} />
          )}
      </div>

      <div className="fixed bottom-0 left-0 md:left-[60px] right-0 z-50">
        <BottomBar onAssetSelect={(a) => setCurrentAssetId(a.id)} currentAssetId={currentAssetId} />
      </div>
    </div>
  );
}

// --- COMPOSANTS UI ---

function RankMiniCard({ title, rank, value, icon, isPnl }: any) {
  const isPositive = !isPnl || !value.includes('-');
  
  let valueColor = 'text-slate-900 dark:text-white'; // Couleur neutre par défaut pour les points et le reste
  if (isPnl) valueColor = isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';

  return (
    <div className="flex flex-col items-start px-4 border-l border-slate-200 dark:border-zinc-800 first:border-0 first:pl-0">
      <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-1 mb-0.5">
        {icon} {title} Rank
      </p>
      <p className="text-base font-black text-slate-900 dark:text-white">#{rank}</p>
      <p className={`text-[10px] font-mono font-bold mt-0.5 ${valueColor}`}>
          {value}
      </p>
    </div>
  );
}

function FilterPill({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 sm:flex-none px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors whitespace-nowrap ${
        active 
          ? 'bg-white dark:bg-[#111] shadow-sm text-slate-900 dark:text-white' 
          : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );
}
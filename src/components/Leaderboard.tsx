"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, Wallet, ArrowLeft, Target } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { BottomBar } from "@/components/BottomBar";
import { useAccount } from 'wagmi';

// IMPORT DU NOUVEAU COMPOSANT
import TraderExplorerView from "@/components/TraderExplorerView";

// --- UTILITAIRES ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;

export default function Leaderboard() {
  const { address: connectedAddress } = useAccount();
  const { data: wsData } = useWebSocket();
  const [currentAssetId, setCurrentAssetId] = useState<number>(0);
  
  const [view, setView] = useState<'list' | 'trader'>('list');
  const [targetTrader, setTargetTrader] = useState<string>(""); 
  const [activeTab, setActiveTab] = useState<'pnl' | 'volume' | 'trades'>('pnl');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userRanks, setUserRanks] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const addr = connectedAddress || "0xca30cd2760e48af1be32c8420e71803da6735142";
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

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white font-sans selection:bg-slate-200 dark:selection:bg-zinc-800 overflow-y-auto pb-[60px] transition-colors duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      <div className="w-full flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-zinc-800/50 pt-12 pb-6 px-8 bg-white dark:bg-black sticky top-0 z-40 transition-colors duration-300">
        <div className="flex flex-col gap-4 mb-4 md:mb-0 w-full md:w-auto">
            <div>
                <div className="flex items-center gap-3 cursor-pointer group w-fit" onClick={() => { setView('list'); setSearchQuery(""); }}>
                    {view === 'trader' && <ArrowLeft size={20} className="text-slate-400 dark:text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors" />}
                    <h1 className="text-2xl font-bold tracking-tight group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">Hall of Fame</h1>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] font-mono uppercase tracking-wider rounded">Leaderboard</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mt-1">Top traders by performance and activity.</p>
            </div>

            {userRanks && view === 'list' && (
                <div className="flex items-center gap-6 mt-2">
                    <RankMiniCard title="Activity" rank={userRanks.activity.rank} value={`${userRanks.activity.value} trades`} icon={<Target size={12}/>} />
                    <RankMiniCard title="Volume" rank={userRanks.volume.rank} value={formatCurrency(formatE6(userRanks.volume.value))} icon={<Wallet size={12}/>} />
                    <RankMiniCard title="PnL" rank={userRanks.pnl.rank} value={formatCurrency(formatE6(userRanks.pnl.value))} icon={<TrendingUp size={12}/>} isPnl />
                </div>
            )}
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full md:w-[450px]">
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

      <div className="w-full px-8 py-8 space-y-6">
          {view === 'list' ? (
              <div className="w-full bg-white dark:bg-[#0a0a0a] shadow-sm border border-slate-200 dark:border-zinc-800/60 rounded-xl overflow-hidden min-h-[500px]">
                  
                  <div className="flex border-b border-slate-200 dark:border-zinc-800/60 bg-slate-100 dark:bg-zinc-950/30 sticky top-0 z-10">
                    <TabButton active={activeTab === 'pnl'} onClick={() => setActiveTab('pnl')} label="PnL Ranking" />
                    <TabButton active={activeTab === 'volume'} onClick={() => setActiveTab('volume')} label="Volume Ranking" />
                    <TabButton active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Most Active" />
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
                                const val = activeTab === 'pnl' ? t.pnl : activeTab === 'volume' ? t.volume : t.totalTrades;
                                const isPositive = typeof val === 'number' && val >= 0;

                                return (
                                    <tr key={t.trader} className="hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors cursor-pointer group" onClick={() => handleTraderClick(t.trader)}>
                                        <td className="px-6 py-3">
                                            <span className={`text-[11px] font-bold ${i < 3 ? 'text-blue-500' : 'text-slate-400 dark:text-zinc-600'}`}>#{i + 1}</span>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-[11px] text-slate-600 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                            {t.trader}
                                            {connectedAddress === t.trader && <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[8px] font-bold rounded uppercase">You</span>}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-mono font-bold text-[11px] ${activeTab === 'pnl' ? (isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500') : 'text-slate-900 dark:text-white'}`}>
                                            {activeTab === 'trades' ? val : (activeTab === 'pnl' ? (isPositive ? '+' : '') + formatUSDExact(formatE6(val)) : formatCurrency(formatE6(val)))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                  </div>
              </div>
          ) : (
              // ICI ON IMPORTE LE COMPOSANT SÉCURIISÉ
              <TraderExplorerView address={targetTrader} wsData={wsData} />
          )}
      </div>

      <div className="fixed bottom-0 left-0 md:left-[60px] right-0 z-50">
        <BottomBar onAssetSelect={(a) => setCurrentAssetId(a.id)} currentAssetId={currentAssetId} />
      </div>
    </div>
  );
}

function RankMiniCard({ title, rank, value, icon, isPnl }: any) {
  const isPositive = !isPnl || !value.includes('-');
  return (
    <div className="flex flex-col items-start px-4 border-l border-slate-200 dark:border-zinc-800">
      <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-1">
        {icon} {title} Rank
      </p>
      <p className="text-sm font-black text-slate-900 dark:text-white">#{rank}</p>
      <p className={`text-[10px] font-mono font-bold ${isPnl ? (isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500') : 'text-slate-400 dark:text-zinc-400'}`}>
          {value}
      </p>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
        active 
          ? 'text-slate-900 border-slate-900 dark:text-white dark:border-white bg-white dark:bg-zinc-900/50' 
          : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  );
}
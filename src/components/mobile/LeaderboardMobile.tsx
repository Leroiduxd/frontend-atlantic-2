"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, Wallet, ArrowLeft, Target, Trophy } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAccount } from 'wagmi';
import TraderExplorerView from "@/components/TraderExplorerView";

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
      const addr = connectedAddress || "0xca30cd2760e48af1be32c8420e71803da6735142"; // Fallback demo
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
    <div className="flex flex-col h-full w-full bg-white dark:bg-black text-slate-900 dark:text-white font-sans transition-colors overflow-hidden">
      
      {/* HEADER */}
      <div className="flex-none flex flex-col p-4 border-b border-slate-200 dark:border-zinc-900">
        <div className="flex items-center gap-3 mb-3">
          {view === 'trader' ? (
             <button onClick={() => { setView('list'); setSearchQuery(""); }} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-900">
                 <ArrowLeft size={20} className="text-slate-900 dark:text-white" />
             </button>
          ) : (
             <Trophy size={20} className="text-amber-500" />
          )}
          <h1 className="text-lg font-bold">Hall of Fame</h1>
        </div>

        {view === 'list' && (
            <form onSubmit={handleSearch} className="relative w-full">
                <div className="flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 transition-colors h-10">
                    <input
                        type="text"
                        placeholder="Search Address 0x..."
                        className="flex-1 bg-transparent px-3 text-xs font-mono outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="w-10 h-full flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-blue-500 transition-colors">
                        <Search size={14} />
                    </button>
                </div>
            </form>
        )}
      </div>

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {view === 'list' ? (
              <div className="flex flex-col">
                  {/* USER RANKS (Si connecté) */}
                  {userRanks && (
                      <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-100 dark:border-zinc-900/50">
                          <RankMiniCard title="Trades" rank={userRanks.activity.rank} value={`${userRanks.activity.value}`} icon={<Target size={10}/>} />
                          <RankMiniCard title="Volume" rank={userRanks.volume.rank} value={formatCurrency(formatE6(userRanks.volume.value))} icon={<Wallet size={10}/>} />
                          <RankMiniCard title="PnL" rank={userRanks.pnl.rank} value={formatCurrency(formatE6(userRanks.pnl.value))} icon={<TrendingUp size={10}/>} isPnl />
                      </div>
                  )}

                  {/* TABS */}
                  <div className="flex border-b border-slate-200 dark:border-zinc-900 sticky top-0 bg-white dark:bg-black z-10">
                    <TabButton active={activeTab === 'pnl'} onClick={() => setActiveTab('pnl')} label="PnL" />
                    <TabButton active={activeTab === 'volume'} onClick={() => setActiveTab('volume')} label="Volume" />
                    <TabButton active={activeTab === 'trades'} onClick={() => setActiveTab('trades')} label="Trades" />
                  </div>

                  {/* LISTE */}
                  <div className="flex flex-col pb-4">
                    {loading ? (
                        <div className="p-8 text-center text-xs font-mono text-slate-400 dark:text-zinc-600 animate-pulse">Loading leaderboard...</div>
                    ) : filteredList.map((t: any, i: number) => {
                        const val = activeTab === 'pnl' ? t.pnl : activeTab === 'volume' ? t.volume : t.totalTrades;
                        const isPositive = typeof val === 'number' && val >= 0;

                        return (
                            <div 
                                key={t.trader} 
                                onClick={() => handleTraderClick(t.trader)}
                                className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900/50 active:bg-slate-50 dark:active:bg-zinc-900 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 text-center text-xs font-bold ${i < 3 ? 'text-amber-500' : 'text-slate-400 dark:text-zinc-500'}`}>
                                        #{i + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-slate-700 dark:text-zinc-300">
                                                {shortenAddress(t.trader)}
                                            </span>
                                            {connectedAddress?.toLowerCase() === t.trader.toLowerCase() && (
                                                <span className="px-1.5 py-[1px] bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[8px] font-bold rounded uppercase">You</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={`text-right font-mono font-bold text-xs ${activeTab === 'pnl' ? (isPositive ? 'text-[#2EBD85]' : 'text-[#F6465D]') : 'text-slate-900 dark:text-white'}`}>
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
    </div>
  );
};

// COMPOSANTS UTILE POUR MOBILE
function RankMiniCard({ title, rank, value, icon, isPnl }: any) {
  const isPositive = !isPnl || !value.includes('-');
  return (
    <div className="flex flex-col items-center p-2 bg-slate-50 dark:bg-[#111] rounded-md border border-slate-100 dark:border-zinc-800">
      <div className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-1 mb-1">
        {icon} {title}
      </div>
      <div className="text-xs font-black text-slate-900 dark:text-white">#{rank}</div>
      <div className={`text-[9px] font-mono mt-0.5 ${isPnl ? (isPositive ? 'text-[#2EBD85]' : 'text-[#F6465D]') : 'text-slate-400 dark:text-zinc-400'}`}>
          {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
        active 
          ? 'text-blue-600 border-blue-600 dark:text-white dark:border-white' 
          : 'text-slate-500 border-transparent dark:text-zinc-500'
      }`}
    >
      {label}
    </button>
  );
}
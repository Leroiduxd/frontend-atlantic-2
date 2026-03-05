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

  // --- LOGIQUE DE PARTAGE (CALCUL DU NON-RÉALISÉ + GÉNÉRATION PNG) ---
  const handleShareStats = async () => {
    if (!connectedAddress || !userRanks) return;
    setIsSharing(true);

    try {
        // 1. On calcule le PnL non-réalisé en live pour la carte
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
                
                // Recherche du prix live via WebSocket
                const categories = getAssetsByCategory(wsData || {});
                const match = Object.values(categories).flat().find((a: any) => a.id === t.assetId);
                const wsPrice = match && match.currentPrice ? parseFloat(match.currentPrice) : 0;

                if (wsPrice > 0) {
                    totalUnrealized += size * (wsPrice - entryP) * (t.isLong ? 1 : -1);
                }
            });
        }
        setUnrealizedForShare(totalUnrealized);

        // 2. On laisse React mettre à jour le composant caché (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));

        // 3. Import dynamique de html2canvas (pour éviter les erreurs SSR sur Next.js)
        const html2canvas = (await import('html2canvas')).default;

        // 4. Capture de la div cachée
        if (!printRef.current) return;
        const canvas = await html2canvas(printRef.current, { 
            backgroundColor: '#0a0a0a',
            scale: 2, // Haute qualité pour Twitter
            useCORS: true
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Erreur de génération d'image");
        const file = new File([blob], 'brokex-stats.png', { type: 'image/png' });

        const shareText = `Check out my trading stats on Brokex! 🏆\n\n📈 Rank: #${userRanks.pnl.rank}\n💰 Realized PnL: $${formatCurrency(formatE6(userRanks.pnl.value))}\n\nTrade now on Brokex! #Crypto #Trading #DeFi`;

        // 5. Utilisation de l'API Share native du téléphone (qui supporte les images)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'My Brokex Stats',
                text: shareText,
                files: [file]
            });
        } else {
            // Fallback (PC ou navigateur non compatible) : Télécharge l'image et ouvre Twitter
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
                      <div className="flex flex-col p-4 border-b border-slate-100 dark:border-zinc-900/50 bg-slate-50/50 dark:bg-zinc-900/10">
                          <div className="grid grid-cols-3 gap-2 mb-3">
                              <RankMiniCard title="Trades" rank={userRanks.activity.rank} value={`${userRanks.activity.value}`} icon={<Target size={10}/>} />
                              <RankMiniCard title="Volume" rank={userRanks.volume.rank} value={formatCurrency(formatE6(userRanks.volume.value))} icon={<Wallet size={10}/>} />
                              <RankMiniCard title="PnL" rank={userRanks.pnl.rank} value={formatCurrency(formatE6(userRanks.pnl.value))} icon={<TrendingUp size={10}/>} isPnl />
                          </div>
                          <button 
                              onClick={handleShareStats} 
                              disabled={isSharing}
                              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-70"
                          >
                              {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                              {isSharing ? 'Generating Image...' : 'Share My Stats'}
                          </button>
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

                        // Remplacement du vert par le bleu pour les variations positives
                        const pnlColorClass = activeTab === 'pnl' 
                            ? (isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500') 
                            : 'text-slate-900 dark:text-white';

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
                                
                                <div className={`text-right font-mono font-bold text-xs ${pnlColorClass}`}>
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
      {/* CARTE CACHÉE POUR LA GÉNÉRATION DE L'IMAGE (HTML2CANVAS)                  */}
      {/* ========================================================================= */}
      {userRanks && connectedAddress && (
        <div className="fixed top-[-9999px] left-[-9999px]">
            <div ref={printRef} className="w-[600px] h-[750px] bg-[#0a0a0a] border-4 border-zinc-800 p-10 flex flex-col justify-between font-sans text-white relative overflow-hidden">
                
                {/* Background Design (Optionnel) */}
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

// COMPOSANTS UTILE POUR MOBILE
function RankMiniCard({ title, rank, value, icon, isPnl }: any) {
  const isPositive = !isPnl || !value.includes('-');
  
  // Utilisation stricte du bleu pour le positif ici aussi
  const valueColor = isPnl 
    ? (isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500') 
    : 'text-slate-500 dark:text-zinc-400';

  return (
    <div className="flex flex-col items-center p-2 bg-white dark:bg-[#111] rounded-md border border-slate-200 dark:border-zinc-800">
      <div className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-1 mb-1">
        {icon} {title}
      </div>
      <div className="text-xs font-black text-slate-900 dark:text-white">#{rank}</div>
      <div className={`text-[9px] font-mono mt-0.5 ${valueColor}`}>
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
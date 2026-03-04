"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { format } from "date-fns";
import { useTheme } from "next-themes";
import { AssetIcon } from "@/hooks/useAssetIcon"; // Import direct du composant
import { getAssetsByCategory } from '@/hooks/useWebSocket';

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

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatUSDExact = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;

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

export default function TraderExplorerView({ address, wsData }: { address: string, wsData: any }) {
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
            if (!wsData) return 0;
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
                totalUnrealized += pnl;
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

            <div className="flex border-b border-slate-200 dark:border-zinc-800/60 bg-slate-100 dark:bg-zinc-950/30 sticky top-0 z-10">
                {['open','pending','closed','cancelled'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab ? 'text-slate-900 border-slate-900 bg-white dark:text-white dark:border-white dark:bg-zinc-900/50' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-200/50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900/30'}`}>
                        {tab}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500 dark:text-zinc-500 font-mono text-sm animate-pulse">Fetching trader history...</div>
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
                )}
            </div>
        </div>
    );
}
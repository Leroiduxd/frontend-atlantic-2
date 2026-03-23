"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Activity, Clock, CheckCircle, XCircle, TrendingUp, Wallet, Target, Search, Edit2, Plus, X, Check } from "lucide-react";

import { usePortfolio, formatAssetPrice, formatUSD, getDisplaySymbol, getMarketProof } from "@/hooks/usePortfolio";
import { TRADING_ADDRESS, TRADING_ABI } from "@/constants/addresses";

// --- UTILS ---
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
const formatE6 = (val: number) => val / 1_000_000;

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";
type EditAction = 'close' | 'margin' | 'sltp' | null;

const PortfolioView = () => {
  const { address } = useAccount();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<TabType>("openPositions");
  const [searchQuery, setSearchQuery] = useState("");
  
  // États pour l'édition en ligne
  const [activeEditId, setActiveEditId] = useState<number | null>(null);
  const [editAction, setEditAction] = useState<EditAction>(null);
  const [editVal1, setEditVal1] = useState<string>(""); 
  const [editVal2, setEditVal2] = useState<string>(""); 
  
  const [userStats, setUserStats] = useState<any>(null);

  const { openPositions, pendingOrders, closedPositions, cancelledOrders, assetSymbolMap, fetchTrades } = usePortfolio();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // --- FETCH DES STATISTIQUES ---
  useEffect(() => {
    if (!address) return;
    fetch(`https://api.brokex.trade/trader/${address}/ranks`)
      .then(r => r.json())
      .then(d => { if (d.success) setUserStats(d.ranks); })
      .catch(console.error);
  }, [address]);

  const totalUnrealizedPnl = useMemo(() => {
    return openPositions.reduce((sum, pos) => sum + (pos.calculatedPNL || 0), 0);
  }, [openPositions]);

  // --- FILTRAGE AVEC RECHERCHE ---
  const currentData = useMemo(() => {
    let list = [];
    switch (activeTab) {
      case "openPositions": list = openPositions; break;
      case "pendingOrders": list = pendingOrders; break;
      case "closedPositions": list = closedPositions; break;
      case "cancelledOrders": list = cancelledOrders; break;
      default: list = [];
    }

    if (!searchQuery) return list;
    const lowerQuery = searchQuery.toLowerCase();
    return list.filter((trade: any) => 
      trade.id.toString().includes(lowerQuery) || 
      getDisplaySymbol(trade.assetSymbol, trade.asset_id).toLowerCase().includes(lowerQuery)
    );
  }, [activeTab, openPositions, pendingOrders, closedPositions, cancelledOrders, searchQuery]);

  // --- HANDLERS ACTIONS SMART CONTRACTS ---
  const startEdit = (id: number, action: EditAction, defaultVal1 = "", defaultVal2 = "") => {
      setActiveEditId(id);
      setEditAction(action);
      setEditVal1(defaultVal1);
      setEditVal2(defaultVal2);
  };

  const cancelEdit = () => {
      setActiveEditId(null);
      setEditAction(null);
  };

  const submitEdit = async (trade: any) => {
      if (!address) return;
      try {
          if (editAction === 'close') {
              const lotsToClose = parseFloat(editVal1);
              if (isNaN(lotsToClose) || lotsToClose <= 0) throw new Error("Invalid lots amount");
              const proof = await getMarketProof(trade.asset_id); 
              await writeContractAsync({
                  address: TRADING_ADDRESS,
                  abi: TRADING_ABI,
                  functionName: 'closePositionMarket',
                  args: [BigInt(trade.id), lotsToClose, proof]
              });
              toast({ title: "Close Order Sent", description: "Transaction submitted." });
          } 
          else if (editAction === 'margin') {
              const marginAmt = parseFloat(editVal1);
              if (isNaN(marginAmt) || marginAmt <= 0) throw new Error("Invalid margin amount");
              const amount6Num = Math.floor(marginAmt * 1e6);
              await writeContractAsync({
                  address: TRADING_ADDRESS,
                  abi: TRADING_ABI,
                  functionName: 'addMargin',
                  args: [BigInt(trade.id), BigInt(amount6Num)]
              });
              toast({ title: "Margin Added", description: "Transaction submitted." });
          }
          else if (editAction === 'sltp') {
              const sl = editVal1 === "" ? 0n : BigInt(Math.floor(parseFloat(editVal1) * 1e6));
              const tp = editVal2 === "" ? 0n : BigInt(Math.floor(parseFloat(editVal2) * 1e6));
              await writeContractAsync({
                  address: TRADING_ADDRESS,
                  abi: TRADING_ABI,
                  functionName: 'updateSLTP',
                  args: [BigInt(trade.id), sl, tp]
              });
              toast({ title: "SL/TP Updated", description: "Transaction submitted." });
          }
          
          cancelEdit();
          setTimeout(() => fetchTrades(), 3000);
      } catch (e: any) {
          toast({ title: "Error", description: e.message || "Action failed.", variant: "destructive" });
      }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
        await writeContractAsync({
            address: TRADING_ADDRESS,
            abi: TRADING_ABI,
            functionName: 'cancelOrder',
            args: [BigInt(id)]
        });
        toast({ title: "Cancel Order Sent", description: "Transaction submitted." });
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to cancel.", variant: "destructive" });
    }
  };

  const tabConfig = [
    { id: "openPositions" as const, label: "Open Positions", icon: <Activity size={16}/>, count: openPositions.length },
    { id: "pendingOrders" as const, label: "Pending Orders", icon: <Clock size={16}/>, count: pendingOrders.length },
    { id: "closedPositions" as const, label: "History", icon: <CheckCircle size={16}/>, count: closedPositions.length },
    { id: "cancelledOrders" as const, label: "Cancelled", icon: <XCircle size={16}/>, count: cancelledOrders.length },
  ];

  if (!address) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0a0a0a]">
        <Briefcase className="w-16 h-16 text-gray-300 dark:text-zinc-700 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Please connect your wallet</h2>
        <p className="text-gray-500 dark:text-zinc-500 mt-2">Connect to view your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-slate-50 dark:bg-black font-['Source_Code_Pro',_monospace] overflow-hidden">
      
      {/* HEADER / STATS BOARD */}
      <div className="w-full flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 dark:border-zinc-800/50 pt-10 pb-6 px-8 bg-white dark:bg-black sticky top-0 z-40">
        
        {/* STATS GAUCHE */}
        <div className="flex flex-col gap-4 mb-6 md:mb-0 w-full md:w-auto">
            <div className="flex items-center gap-4 mt-2">
                <StatCard title="Unrealized PnL" value={totalUnrealizedPnl} icon={<Activity size={12}/>} isPnl isExact />
                <StatCard title="Realized PnL" value={userStats?.pnl?.value ? formatE6(userStats.pnl.value) : 0} icon={<TrendingUp size={12}/>} isPnl isExact />
                <StatCard title="Volume" value={userStats?.volume?.value ? formatCurrency(formatE6(userStats.volume.value)) : "$0.00"} icon={<Wallet size={12}/>} />
                <StatCard title="Activity" value={`${userStats?.activity?.value || 0} trades`} icon={<Target size={12}/>} />
            </div>
        </div>

        {/* BARRE DE RECHERCHE DROITE */}
        <div className="flex flex-col items-end gap-3 w-full md:w-[300px]">
            <div className="relative flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-md focus-within:border-slate-400 dark:focus-within:border-zinc-500 transition-colors w-full">
                <Search size={14} className="absolute left-3 text-slate-400 dark:text-zinc-500" />
                <input
                    type="text"
                    placeholder="Search pair or ID..."
                    className="flex-1 bg-transparent pl-9 pr-4 h-9 outline-none text-xs placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-slate-900 dark:text-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-8 py-6 overflow-hidden">
          
        {/* TABS */}
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-zinc-800 mb-6 [&::-webkit-scrollbar]:hidden flex-shrink-0">
            {tabConfig.map((tab) => (
            <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); cancelEdit(); }}
                className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                    ? "text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10"
                    : "text-gray-500 border-transparent hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700"
                }`}
            >
                {tab.icon} {tab.label}
                <span className="ml-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                </span>
            </button>
            ))}
        </div>

        {/* TABLEAU */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm [&::-webkit-scrollbar]:hidden">
            {currentData.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                <thead className="bg-gray-50 dark:bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Asset / ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Side / Lev</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Entry Price</th>
                    
                    {activeTab === "openPositions" && (
                        <>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Mark / Liq</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">SL / TP</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Unrealized PNL</th>
                        </>
                    )}
                    {activeTab === "pendingOrders" && (
                        <>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Target Price</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">SL / TP</th>
                        </>
                    )}
                    {activeTab === "closedPositions" && (
                        <>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Close Price</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Realized PNL</th>
                        </>
                    )}
                    
                    {(activeTab === "openPositions" || activeTab === "pendingOrders") && (
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider min-w-[280px]">Actions</th>
                    )}
                </tr>
                </thead>
                
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                {currentData.map((trade: any) => (
                    <tr key={trade.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    
                    {/* Pair / ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">
                            {getDisplaySymbol(trade.assetSymbol, trade.asset_id)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-zinc-500 flex gap-2">
                            <span>#{trade.id}</span>
                            <span>{format(new Date(trade.created_at * 1000), "MM/dd HH:mm")}</span>
                        </div>
                    </td>
                    
                    {/* Side & Leverage */}
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${trade.long_side ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                            {trade.long_side ? 'LONG' : 'SHORT'}
                            </span>
                            <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">{trade.leverage_x}x</span>
                        </div>
                    </td>

                    {/* Size */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-zinc-300 font-medium">
                        {trade.size}
                    </td>

                    {/* Entry Price */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-zinc-300 font-medium">
                        {trade.entry_x6 ? formatAssetPrice(trade.entry_x6, trade.asset_id, assetSymbolMap) : '---'}
                    </td>

                    {/* DYNAMIC: OPEN POSITIONS */}
                    {activeTab === "openPositions" && (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-zinc-300 font-bold">{trade.currentPrice || '---'}</div>
                                <div className="text-xs text-red-500 font-bold mt-0.5">Liq: {formatAssetPrice(trade.liq_x6, trade.asset_id, assetSymbolMap)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-xs text-gray-500 dark:text-zinc-400">SL: <span className="text-gray-900 dark:text-zinc-300 font-medium">{trade.sl_x6 > 0 ? formatAssetPrice(trade.sl_x6, trade.asset_id, assetSymbolMap) : 'None'}</span></div>
                                <div className="text-xs text-gray-500 dark:text-zinc-400">TP: <span className="text-gray-900 dark:text-zinc-300 font-medium">{trade.tp_x6 > 0 ? formatAssetPrice(trade.tp_x6, trade.asset_id, assetSymbolMap) : 'None'}</span></div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className={`font-bold text-sm ${trade.calculatedPNL >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {trade.calculatedPNL >= 0 ? '+' : ''}{trade.calculatedPNL?.toFixed(2) || '0.00'} USD
                                </div>
                                <div className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                                    Mgn: ${formatUSD(trade.margin_usd6)}
                                </div>
                            </td>
                        </>
                    )}

                    {/* DYNAMIC: PENDING ORDERS */}
                    {activeTab === "pendingOrders" && (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-zinc-300 font-medium">
                                {formatAssetPrice(trade.target_x6, trade.asset_id, assetSymbolMap)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-xs text-gray-500 dark:text-zinc-400">SL: <span className="text-gray-900 dark:text-zinc-300 font-medium">{trade.sl_x6 > 0 ? formatAssetPrice(trade.sl_x6, trade.asset_id, assetSymbolMap) : 'None'}</span></div>
                                <div className="text-xs text-gray-500 dark:text-zinc-400">TP: <span className="text-gray-900 dark:text-zinc-300 font-medium">{trade.tp_x6 > 0 ? formatAssetPrice(trade.tp_x6, trade.asset_id, assetSymbolMap) : 'None'}</span></div>
                            </td>
                        </>
                    )}

                    {/* DYNAMIC: CLOSED POSITIONS */}
                    {activeTab === "closedPositions" && (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-zinc-300 font-medium">
                                {trade.closePriceX6 ? formatAssetPrice(trade.closePriceX6, trade.asset_id, assetSymbolMap) : '---'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className={`font-bold text-sm ${(trade.pnl_usd6 || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {(trade.pnl_usd6 || 0) >= 0 ? '+' : ''}{trade.pnl_usd6 ? formatUSD(trade.pnl_usd6) : '0.00'} USD
                                </div>
                            </td>
                        </>
                    )}

                    {/* ACTIONS COLUMNS (Only Open & Pending) */}
                    {(activeTab === "openPositions" || activeTab === "pendingOrders") && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {activeEditId === trade.id ? (
                                <div className="flex items-center justify-end gap-3 animate-in fade-in zoom-in duration-200">
                                    {editAction === 'sltp' && (
                                        <div className="flex flex-row items-center gap-3">
                                            <CustomNumberInput placeholder="SL Price" value={editVal1} onChange={setEditVal1} step={0.1} />
                                            <CustomNumberInput placeholder="TP Price" value={editVal2} onChange={setEditVal2} step={0.1} />
                                        </div>
                                    )}
                                    {editAction === 'margin' && (
                                        <CustomNumberInput placeholder="+ USD" value={editVal1} onChange={setEditVal1} step={10} />
                                    )}
                                    {editAction === 'close' && (
                                        <CustomNumberInput placeholder="Lots" value={editVal1} onChange={setEditVal1} step={0.01} max={trade.lots - trade.closed_lots} />
                                    )}
                                    
                                    <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-700 pl-3">
                                        <button onClick={() => submitEdit(trade)} disabled={isWritePending} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-md transition-colors"><Check size={14}/></button>
                                        <button onClick={cancelEdit} className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-white p-1.5 rounded-md transition-colors"><X size={14}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-2">
                                    
                                    {/* Edit SL/TP (Always visible) */}
                                    <button 
                                        onClick={() => startEdit(trade.id, 'sltp', trade.sl_x6 > 0 ? (trade.sl_x6 / 1e6).toString() : "", trade.tp_x6 > 0 ? (trade.tp_x6 / 1e6).toString() : "")}
                                        className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Edit SL/TP"
                                    ><Edit2 size={16} /></button>

                                    {/* Add Margin (Always visible) */}
                                    {activeTab === "openPositions" && (
                                        <button 
                                            onClick={() => startEdit(trade.id, 'margin')}
                                            className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                            title="Add Margin"
                                        ><Plus size={16} /></button>
                                    )}

                                    {/* Close / Cancel Button (Always visible) */}
                                    {activeTab === "openPositions" ? (
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-8 px-4 text-xs bg-transparent dark:bg-transparent text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 dark:border-red-900/50 dark:hover:bg-red-900/20 ml-2 transition-colors"
                                            onClick={() => startEdit(trade.id, 'close', (trade.lots - trade.closed_lots).toString())} 
                                            disabled={isWritePending || !trade.isMarketOpen}
                                        >
                                            {!trade.isMarketOpen ? "Closed" : "Close"}
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-8 px-4 text-xs ml-2"
                                            onClick={() => handleCancelOrder(trade.id)} 
                                            disabled={isWritePending}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            )}
                        </td>
                    )}

                    </tr>
                ))}
                </tbody>
            </table>
            ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-zinc-600 p-8">
                <Activity className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">No {activeTab.replace(/([A-Z])/g, ' $1').toLowerCase()} found.</p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- COMPOSANTS UI ANNEXES ---

function StatCard({ title, value, icon, isPnl, isExact }: any) {
    const numericValue = typeof value === 'number' ? value : 0;
    const isPositive = !isPnl || numericValue >= 0;
    
    let valueColor = 'text-slate-900 dark:text-white';
    if (isPnl) valueColor = isPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
  
    let displayValue = value;
    if (isPnl && typeof value === 'number') {
        const sign = isPositive ? '+' : '';
        displayValue = `${sign}${(isExact ? value : value).toFixed(2)} USD`;
    }
  
    return (
      <div className="flex flex-col items-start px-4 border-l border-slate-200 dark:border-zinc-800/60 first:border-0 first:pl-0">
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-widest flex items-center gap-1.5 mb-1">
          {icon} {title}
        </p>
        <p className={`text-lg font-black tracking-tight ${valueColor}`}>
            {displayValue}
        </p>
      </div>
    );
}

// Custom Input Numérique pour remplacer les +/- par défaut du navigateur
function CustomNumberInput({ value, onChange, placeholder, step = 1, min = 0, max }: any) {
    const handleInc = () => {
      const v = parseFloat(value) || 0;
      if (max !== undefined && v + step > max) {
          onChange(max.toString());
      } else {
          onChange(parseFloat((v + step).toFixed(4)).toString());
      }
    };
    
    const handleDec = () => {
      const v = parseFloat(value) || 0;
      if (v - step < min) {
          onChange(min.toString());
      } else {
          onChange(parseFloat((v - step).toFixed(4)).toString());
      }
    };
  
    return (
      <div className="flex items-center bg-gray-100 dark:bg-zinc-800/80 rounded-md border border-gray-200 dark:border-zinc-700 h-8 overflow-hidden">
        <button onClick={handleDec} className="w-7 h-full flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white transition-colors">-</button>
        <input
          type="number"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // La classe ci-dessous cache les flèches du navigateur (spin-buttons) et force le texte clair en dark mode
          className="w-[72px] h-full bg-transparent text-center text-[11px] font-semibold text-gray-900 dark:text-white outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
        <button onClick={handleInc} className="w-7 h-full flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white transition-colors">+</button>
      </div>
    );
  }

export default PortfolioView;
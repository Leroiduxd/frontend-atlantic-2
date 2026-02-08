"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EditStopsDialog } from "./EditStopsDialog"; 
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/usePaymaster"; 
import { ChevronDown, ChevronUp } from 'lucide-react'; 
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';

// --- MAPPING DES PAIRES (AJOUTÉ) ---
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

// --- CONFIGURATION SMART CONTRACT (PAYMASTER) ---

const PAYMASTER_ADDRESS = '0x0afFdf07Cad8B950b823d8C953ee3d986a9A5FbC';

const PAYMASTER_ABI = [
  // --- VIEWS ---
  {
    "inputs": [
      { "internalType": "address", "name": "trader", "type": "address" },
      { "internalType": "uint256", "name": "cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "size", "type": "uint256" }
    ],
    "name": "getTradesPagination",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "trader", "type": "address" },
          { "internalType": "uint32", "name": "assetId", "type": "uint32" },
          { "internalType": "bool", "name": "isLong", "type": "bool" },
          { "internalType": "bool", "name": "isLimit", "type": "bool" }, 
          { "internalType": "uint8", "name": "leverage", "type": "uint8" },
          { "internalType": "uint48", "name": "openPrice", "type": "uint48" },
          { "internalType": "uint8", "name": "state", "type": "uint8" },
          { "internalType": "uint32", "name": "openTimestamp", "type": "uint32" },
          { "internalType": "uint128", "name": "fundingIndex", "type": "uint128" },
          { "internalType": "uint48", "name": "closePrice", "type": "uint48" },
          { "internalType": "int32", "name": "lotSize", "type": "int32" },
          { "internalType": "uint48", "name": "stopLoss", "type": "uint48" },
          { "internalType": "uint48", "name": "takeProfit", "type": "uint48" },
          { "internalType": "uint64", "name": "lpLockedCapital", "type": "uint64" },
          { "internalType": "uint64", "name": "marginUsdc", "type": "uint64" }
        ],
        "internalType": "struct IBrokexCore.Trade[]",
        "name": "_trades",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "total", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Mapping pour récupérer les IDs
  {
    "inputs": [
        { "internalType": "address", "name": "", "type": "address" },
        { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "traderTradeIds",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // --- WRITES (Cancel & Close) ---
  {
    "inputs": [{ "internalType": "uint256", "name": "tradeId", "type": "uint256" }],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "bytes", "name": "oracleProof", "type": "bytes" }
    ],
    "name": "closePositionMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// --- UTILS ---

const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);
    if (!response.ok) { throw new Error(`Failed to fetch proof`); }
    const data = await response.json();
    return data.proof as Hash; 
};

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";

interface PositionsSectionProps {
    paymasterEnabled: boolean;
    currentAssetId: number | null;
    currentAssetSymbol?: string;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

// --- HELPERS FORMATAGE ---

const formatAssetPrice = (valueX6: number, assetId: number, symbolMap: any): string => {
    if (valueX6 === 0) return "0.00";
    const assetInfo = symbolMap[assetId];
    const value = valueX6 / 1000000; 
    return value.toFixed(assetInfo?.priceDecimals || 2);
};

const formatUSD = (valueX6: number): string => {
    if (!valueX6 || valueX6 === 0) return "0.00";
    const value = valueX6 / 1000000;
    return value.toFixed(2);
};

// --- COMPOSANT CARTE (Visuel Intact) ---

interface PositionCardProps {
    position: any; 
    isActionDisabled: boolean;
    handleClosePosition: (position: any) => Promise<void>;
    openEditDialog: (position: any) => void;
    symbolMap: any;
    getDisplaySymbol: (assetSymbol: string, assetId: number) => string; 
}

const PositionCard: React.FC<PositionCardProps> = ({ 
    position, 
    isActionDisabled, 
    handleClosePosition, 
    openEditDialog,
    symbolMap,
    getDisplaySymbol 
}) => {
    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    const markPriceText = position.currentPrice || '---'; 
    
    const pnlClass = isPNLPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
    const sideClass = position.long_side 
        ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white font-bold' 
        : 'bg-red-600 text-white dark:bg-red-600 dark:text-white font-bold'; 
        
    const entryPrice = formatAssetPrice(position.entry_x6, position.asset_id, symbolMap);
    const tpPriceFormatted = position.tp_x6 > 0 ? formatAssetPrice(position.tp_x6, position.asset_id, symbolMap) : 'None';
    const slPriceFormatted = position.sl_x6 > 0 ? formatAssetPrice(position.sl_x6, position.asset_id, symbolMap) : 'None';
    
    const marginUsdText = `$${formatUSD(position.margin_usd6)}`;
    const symbolDisplay = getDisplaySymbol(position.assetSymbol, position.asset_id);
    const baseSymbol = position.assetSymbol.split('/')[0];
    const openDate = position.created_at ? format(new Date(position.created_at * 1000), "yyyy-MM-dd HH:mm") : '---';

    return (
        <div className="bg-white dark:bg-black p-4 border-b border-gray-200 dark:border-white/10 text-xs flex flex-col gap-3 font-['Source_Code_Pro',_monospace]"> 
            <div className="flex justify-between items-start pb-1">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="font-extrabold text-lg text-gray-900 dark:text-white truncate">{symbolDisplay}</span> 
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sideClass} flex-shrink-0`}> 
                        {position.long_side ? 'LONG' : 'SHORT'} {position.leverage_x}x
                    </span>
                </div>
                <div className="text-right flex-shrink-0 min-w-[180px]">
                    <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Unrealized PNL</span>
                    <div className={`font-bold text-lg ${pnlClass} leading-tight`}>
                        {isPNLPositive ? '+' : ''}{pnlUsdText} <span className="text-xs font-normal">USD</span> <span className="text-xs font-semibold">({roePercentText}%)</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-start pt-2">
                <div className="grid grid-cols-4 gap-x-6 gap-y-4 flex-grow min-w-0 pr-8">
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Entry Price</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{entryPrice}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Mark Price</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{markPriceText}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Liq. Price</span>
                        <span className="text-red-600 dark:text-red-500 text-xs font-semibold block">-</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Size ({baseSymbol})</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{position.size}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Margin (USD)</span>
                        <span className="text-xs font-semibold block text-gray-900 dark:text-zinc-200">{marginUsdText}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Stop Loss (SL)</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{slPriceFormatted}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Take Profit (TP)</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{tpPriceFormatted}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-zinc-500 block text-[10px] uppercase font-normal">Open Date</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{openDate}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 min-w-[170px] ml-4 flex-shrink-0">
                    <Button
                        onClick={() => handleClosePosition(position)}
                        disabled={isActionDisabled}
                        size="sm"
                        className={`h-8 px-3 text-[12px] font-semibold border rounded-md transition duration-150 w-full 
                            bg-white border-gray-300 hover:bg-gray-50 
                            dark:bg-zinc-900 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-zinc-800
                            ${isActionDisabled ? 'text-gray-500 dark:text-zinc-600' : 'text-red-600'}`}
                        variant="outline"
                    >
                        {isActionDisabled ? 'Processing...' : 'Close Position'}
                    </Button>
                    <Button
                        onClick={() => openEditDialog(position)}
                        disabled={isActionDisabled}
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-[12px] font-semibold border rounded-md transition duration-150 w-full
                            bg-white border-gray-300 text-gray-700 hover:bg-gray-100
                            dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        Modify SL/TP
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- COMPOSANT PRINCIPAL ---

const PositionsSection: React.FC<PositionsSectionProps> = ({ 
  paymasterEnabled,
  currentAssetId,
  currentAssetSymbol,
  isCollapsed, 
  onToggleCollapse, 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("openPositions");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<"all" | "asset">("all");
  
  // -- STATES POUR LES TRADES --
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  const { address } = useAccount();
  const { toast } = useToast();
  const { executeGaslessAction, isLoading: paymasterLoading } = usePaymaster();
  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs, convertLotsToDisplay } = useAssetConfig(); 
  
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // ------------------------------------------------------------------
  //  LOGIQUE DE RÉCUPÉRATION MANUELLE (Trades + IDs)
  // ------------------------------------------------------------------
  
  const fetchTrades = async () => {
    if (!address || !publicClient) return;
    setIsLoadingTrades(true);
    try {
        const cursor = 0n;
        const size = 50n; // On fetch les 50 derniers pour l'exemple

        // 1. Appel getTradesPagination
        const result = await publicClient.readContract({
            address: PAYMASTER_ADDRESS,
            abi: PAYMASTER_ABI,
            functionName: 'getTradesPagination',
            args: [address, cursor, size]
        });
        
        const trades = result[0];
        
        // 2. Appel des IDs en parallèle (traderTradeIds)
        // On doit récupérer l'ID pour chaque trade reçu
        // L'index dans le mapping est (cursor + i)
        const idPromises = trades.map((_, i) => 
            publicClient.readContract({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'traderTradeIds',
                args: [address, cursor + BigInt(i)]
            })
        );

        const ids = await Promise.all(idPromises);

        // 3. Fusion des données
        const merged = trades.map((trade, i) => ({
            ...trade,
            realId: ids[i] // On attache le VRAI ID ici
        }));

        setRawTrades(merged);

    } catch (e) {
        console.error("Error fetching trades:", e);
    } finally {
        setIsLoadingTrades(false);
    }
  };

  // Refresh périodique (toutes les 5s) + au chargement
  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [address, publicClient]);


  // Helpers de configuration
  const assetSymbolMap = useMemo(() => {
    return assetConfigs.reduce((map, config) => {
        const powerOfTen = Math.round(Math.log10(1000000 / config.tick_size_usd6)); 
        const decimals = Math.max(0, powerOfTen);
        map[config.asset_id] = { 
            symbol: `${config.symbol}/USD`, 
            baseSymbol: config.symbol,     
            priceDecimals: decimals,
            priceStep: 1 / (10 ** decimals),
        };
        return map;
    }, {} as { [id: number]: { symbol: string; baseSymbol: string; priceDecimals: number; priceStep: number } });
  }, [assetConfigs]);

  const assetMap = useMemo(() => {
    const allAssets = getAssetsByCategory(wsData).crypto.concat(
        getAssetsByCategory(wsData).forex,
        getAssetsByCategory(wsData).commodities,
        getAssetsByCategory(wsData).stocks,
        getAssetsByCategory(wsData).indices
    );
    return allAssets.reduce((map, asset) => {
      const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
      map[asset.id] = { currentPrice: currentPrice ? parseFloat(currentPrice) : null, pair: asset.pair };
      return map;
    }, {} as { [id: number]: { currentPrice: number | null; pair: string } });
  }, [wsData]);

  // Formatage des données pour l'UI
  const { openPositions, pendingOrders, closedPositions, cancelledOrders } = useMemo(() => {
    
    const open: any[] = [];
    const pending: any[] = [];
    const closed: any[] = [];
    const cancelled: any[] = [];

    rawTrades.forEach((t) => {
        const position = {
            id: Number(t.realId), // ✅ UTILISATION DU VRAI ID RÉCUPÉRÉ
            asset_id: t.assetId,
            long_side: t.isLong,
            is_limit: t.isLimit,
            leverage_x: t.leverage,
            entry_x6: Number(t.openPrice),
            margin_usd6: Number(t.marginUsdc),
            sl_x6: Number(t.stopLoss),
            tp_x6: Number(t.takeProfit),
            lots: Number(t.lotSize),
            created_at: Number(t.openTimestamp),
            target_x6: Number(t.openPrice),
            state: t.state,
            closePriceX6: Number(t.closePrice),
            pnl_usd6: null as number | null
        };

        const assetInfo = assetSymbolMap[position.asset_id];
        const assetWs = assetMap[position.asset_id];
        
        const enriched = {
            ...position,
            assetSymbol: assetInfo ? assetInfo.symbol : `Asset #${position.asset_id}`,
            size: convertLotsToDisplay(position.lots, position.asset_id).toFixed(2),
            priceDecimals: assetInfo ? assetInfo.priceDecimals : 2,
            priceStep: assetInfo ? assetInfo.priceStep : 0.01,
            currentPrice: assetWs?.currentPrice ? assetWs.currentPrice.toFixed(assetInfo?.priceDecimals || 2) : '---',
            calculatedPNL: null as number | null,
            calculatedROE: null as number | null,
            orderTypeString: position.is_limit ? 'Limit' : 'Stop'
        };

        if (t.state === 1) { // OPEN
            if (assetWs?.currentPrice && position.entry_x6 > 0) {
                const currentP = assetWs.currentPrice;
                const entryP = position.entry_x6 / 1000000;
                const direction = position.long_side ? 1 : -1;
                const margin = position.margin_usd6 / 1000000;
                
                const roe = ((currentP / entryP) - 1) * direction * position.leverage_x * 100;
                const pnl = margin * (roe / 100);
                
                enriched.calculatedPNL = pnl;
                enriched.calculatedROE = roe;
            }
            open.push(enriched);
        } 
        else if (t.state === 0) { // PENDING
            pending.push(enriched);
        }
        else if (t.state === 2) { // CLOSED
            const closeP = position.closePriceX6 / 1000000;
            const entryP = position.entry_x6 / 1000000;
            const margin = position.margin_usd6 / 1000000;
            const direction = position.long_side ? 1 : -1;
            
            if (entryP > 0) {
                const roe = ((closeP / entryP) - 1) * direction * position.leverage_x * 100;
                const pnl = margin * (roe / 100);
                enriched.pnl_usd6 = pnl * 1000000; 
            }
            closed.push(enriched);
        }
        else if (t.state === 3) { // CANCELLED
            cancelled.push(enriched);
        }
    });

    open.sort((a, b) => b.created_at - a.created_at);
    pending.sort((a, b) => b.created_at - a.created_at);
    closed.sort((a, b) => b.created_at - a.created_at);
    cancelled.sort((a, b) => b.created_at - a.created_at);

    return { openPositions: open, pendingOrders: pending, closedPositions: closed, cancelledOrders: cancelled };

  }, [rawTrades, assetMap, assetSymbolMap, convertLotsToDisplay]);


  const filterList = (list: any[]) => {
    if (filterMode === "all" || currentAssetId === null) return list;
    return list.filter((p) => p.asset_id === currentAssetId);
  };

  const filteredPositions = filterList(openPositions);
  const filteredOrders = filterList(pendingOrders);
  const filteredClosedPositions = filterList(closedPositions);
  const filteredCancelledOrders = filterList(cancelledOrders);

  // --- ACTIONS HANDLERS ---
  
  const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
      // UTILISATION DE LA MAP EN PRIORITÉ
      if (PAIR_MAP[assetId]) {
          return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
      }
      // Fallback
      const baseSymbol = assetSymbol.split('/')[0];
      return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
  };
  
  const formatDate = (timestamp: number) => {
    try { return format(new Date(timestamp * 1000), "yyyy-MM-dd HH:mm"); } 
    catch { return "---"; }
  };

  const handleClosePosition = async (position: any) => { 
    try {
        if (paymasterEnabled) {
           await executeGaslessAction({ type: 'close', positionId: position.id, assetId: position.asset_id });
           toast({ title: "Close Request Sent", description: "Processing via Paymaster..." });
        } else {
           const proof = await getMarketProof(position.asset_id); 
           await writeContractAsync({
               address: PAYMASTER_ADDRESS,
               abi: PAYMASTER_ABI,
               functionName: 'closePositionMarket',
               args: [BigInt(position.id), proof]
           });
           toast({ title: "Close Order Sent", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e.message || "Failed to close.", variant: "destructive" });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
        if (paymasterEnabled) {
            await executeGaslessAction({ type: 'cancel', orderId: id });
            toast({ title: "Cancel Request Sent", description: "Processing via Paymaster..." });
        } else {
            await writeContractAsync({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'cancelOrder',
                args: [BigInt(id)]
            });
            toast({ title: "Cancel Order Sent", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e.message || "Failed to cancel.", variant: "destructive" });
    }
  };
  
  const handleUpdateStopsLogic = async ({ id, slPrice, tpPrice, isSLChanged, isTPChanged }: any) => { 
    // Logic placeholder
    if (paymasterEnabled) {
        await executeGaslessAction({ type: 'update', id, slPrice: isSLChanged ? Number(slPrice) : undefined, tpPrice: isTPChanged ? Number(tpPrice) : undefined });
    }
    setTimeout(() => fetchTrades(), 2000);
  };
  
  const openEditDialog = (position: any) => { setSelectedPosition(position); setEditDialogOpen(true); };

  const tabConfig = [
    { id: "openPositions" as const, label: `Open Positions (${filteredPositions.length})` },
    { id: "pendingOrders" as const, label: `Pending Orders (${filteredOrders.length})` },
    { id: "closedPositions" as const, label: `Closed Positions (${filteredClosedPositions.length})` },
    { id: "cancelledOrders" as const, label: `Cancelled Orders (${filteredCancelledOrders.length})` },
  ];

  const currentData = useMemo(() => {
    switch (activeTab) {
      case "openPositions": return filteredPositions;
      case "pendingOrders": return filteredOrders;
      case "closedPositions": return filteredClosedPositions; 
      case "cancelledOrders": return filteredCancelledOrders; 
      default: return [];
    }
  }, [activeTab, filteredPositions, filteredOrders, filteredClosedPositions, filteredCancelledOrders]);

  const isActionDisabled = paymasterLoading || isWritePending; 

  return (
    <section id="positions" className="flex flex-col justify-start p-0 w-full h-full bg-white dark:bg-black font-['Source_Code_Pro',_monospace]">
      
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 flex-shrink-0 bg-white dark:bg-black h-9 sticky top-0 z-10">
        <div className="flex justify-start space-x-0 bg-transparent h-full">
            {tabConfig.map((tab) => (
            <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (isCollapsed) { onToggleCollapse(); } }}
                className={`h-full py-0 px-4 rounded-none text-[11px] font-semibold transition duration-200 border-b-2 ${ 
                activeTab === tab.id
                    ? "text-gray-900 dark:text-white border-gray-900 dark:border-white"
                    : "text-gray-500 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-900 border-transparent"
                }`}
            >
                {tab.label}
            </button>
            ))}
        </div>
        
        <div className="flex items-center space-x-3 pr-4 text-[11px] font-medium"> 
            <div className="flex items-center bg-gray-100 dark:bg-zinc-900 rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800">
                <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 text-[11px] ${filterMode === "all" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-semibold" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800"}`}
                >All</button>
                <button
                onClick={() => setFilterMode("asset")}
                disabled={currentAssetId === null}
                className={`px-2 py-0.5 text-[11px] border-l border-gray-200 dark:border-zinc-800 ${filterMode === "asset" ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-semibold" : "text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800"} ${currentAssetId === null ? "opacity-50 cursor-not-allowed" : ""}`}
                >{currentAssetSymbol || "Asset"}</button>
                <button
                    onClick={onToggleCollapse} 
                    className={`h-full px-2 py-0.5 text-[11px] border-l border-gray-200 dark:border-zinc-800 transition duration-150 hover:bg-gray-200 dark:hover:bg-zinc-800 flex items-center justify-center ${isCollapsed ? 'text-gray-900 dark:text-white bg-white dark:bg-zinc-800' : 'text-gray-500 dark:text-zinc-400'}`}
                >
                    {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>
        </div>
      </div>

      {!isCollapsed && (
        <div id="positions-content" className="flex-grow p-0 overflow-y-auto bg-white dark:bg-black">
          {activeTab === "openPositions" && (
              <div className="space-y-0 divide-y divide-gray-200 dark:divide-white/10">
                  {filteredPositions.length > 0 ? (
                      filteredPositions.map((position) => (
                          <PositionCard
                              key={position.id}
                              position={position}
                              isActionDisabled={isActionDisabled}
                              handleClosePosition={handleClosePosition}
                              openEditDialog={openEditDialog}
                              symbolMap={assetSymbolMap}
                              getDisplaySymbol={getDisplaySymbol} 
                          />
                      ))
                  ) : (
                      <div className="flex justify-center items-center h-full text-gray-500 dark:text-zinc-500 p-4">No open positions.</div>
                  )}
              </div>
          )}

          {(activeTab === "pendingOrders" || activeTab === "closedPositions" || activeTab === "cancelledOrders") && (
              <>
              {currentData.length > 0 ? (
                  <div className="overflow-x-auto"> 
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-gray-900 dark:text-zinc-300">
                         <thead className="sticky top-0 bg-white dark:bg-black border-b border-gray-200 dark:border-white/10 z-10">
                           {activeTab === "pendingOrders" && (
                              <tr>
                                <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Pair</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Created</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Type / Side</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Size</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Limit Price</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Margin</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">TP/SL</th>
                                <th className="pr-4 pl-3 py-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Action</th>
                              </tr>
                           )}
                           {activeTab === "closedPositions" && (
                              <tr>
                                <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Pair</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Date</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Side</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Entry</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">P&L</th>
                                <th className="pr-4 pl-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Margin</th>
                              </tr>
                           )}
                           {activeTab === "cancelledOrders" && (
                              <tr>
                                <th className="pl-4 pr-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Pair</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Created</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-lighter text-gray-500 dark:text-zinc-500">Side</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Price</th>
                                <th className="pr-4 pl-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Size</th>
                              </tr>
                           )}
                         </thead>
                         <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                           {activeTab === "pendingOrders" && filteredOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-gray-100 dark:hover:bg-zinc-900 transition duration-100">
                                <td className="pl-4 pr-3 py-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">{getDisplaySymbol(order.assetSymbol, order.asset_id)}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-500 dark:text-zinc-400">{formatDate(order.created_at)}</td>
                                <td className="px-3 py-1.5 text-[11px]">
                                    <span className="text-gray-500 dark:text-zinc-400">{order.orderTypeString}</span> <span className="text-gray-300">/</span> <span className={order.long_side ? "text-blue-600 dark:text-blue-500 font-bold" : "text-red-600 dark:text-red-500 font-bold"}>{order.long_side ? "LONG" : "SHORT"}</span>
                                </td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{order.size}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{formatAssetPrice(order.target_x6, order.asset_id, assetSymbolMap)}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">${formatUSD(order.margin_usd6)}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-500 dark:text-zinc-400">
                                  TP: {order.tp_x6 > 0 ? formatAssetPrice(order.tp_x6, order.asset_id, assetSymbolMap) : 'N/A'}
                                  <br />
                                  SL: {order.sl_x6 > 0 ? formatAssetPrice(order.sl_x6, order.asset_id, assetSymbolMap) : 'N/A'}
                                </td>
                                <td className="pr-4 pl-3 py-1.5 text-right text-[11px]"><Button onClick={() => handleCancelOrder(order.id)} disabled={isActionDisabled} variant="secondary" size="sm" className="h-6 px-2 text-[10px]">Cancel</Button></td>
                              </tr>
                           ))}
                           {activeTab === "closedPositions" && filteredClosedPositions.map((pos) => (
                              <tr key={pos.id} className="hover:bg-gray-100 dark:hover:bg-zinc-900 transition duration-100">
                                <td className="pl-4 pr-3 py-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">{getDisplaySymbol(pos.assetSymbol, pos.asset_id)}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-500 dark:text-zinc-400">{formatDate(pos.created_at)}</td>
                                <td className="px-3 py-1.5 text-[11px]"><span className={pos.long_side ? "text-blue-600 dark:text-blue-500 font-bold" : "text-red-600 dark:text-red-500 font-bold"}>{pos.long_side ? "LONG" : "SHORT"}</span></td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{formatAssetPrice(pos.entry_x6, pos.asset_id, assetSymbolMap)}</td>
                                <td className={`px-3 py-1.5 text-[11px] font-bold ${(pos.pnl_usd6 || 0) >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>{pos.pnl_usd6 ? `$${formatUSD(pos.pnl_usd6)}` : '-'}</td>
                                <td className="pr-4 pl-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">${formatUSD(pos.margin_usd6)}</td>
                              </tr>
                           ))}
                           {activeTab === "cancelledOrders" && filteredCancelledOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-gray-100 dark:hover:bg-zinc-900 transition duration-100">
                                <td className="pl-4 pr-3 py-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">{getDisplaySymbol(order.assetSymbol, order.asset_id)}</td>
                                <td className="px-3 py-1.5 text-gray-500 dark:text-zinc-400">{formatDate(order.created_at)}</td>
                                <td className="px-3 py-1.5 text-[11px]"><span className={order.long_side ? "text-blue-600 dark:text-blue-500 font-bold" : "text-red-600 dark:text-red-500 font-bold"}>{order.long_side ? "LONG" : "SHORT"}</span></td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{formatAssetPrice(order.target_x6, order.asset_id, assetSymbolMap)}</td>
                                <td className="pr-4 pl-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{order.size}</td>
                              </tr>
                           ))}
                         </tbody>
                      </table>
                  </div>
              ) : (
                  <div className="flex justify-center items-center h-full text-gray-500 dark:text-zinc-500 p-4">No {activeTab.replace(/([A-Z])/g, ' $1').toLowerCase()}.</div>
              )}
              </>
          )}
        </div>
      )}

      {selectedPosition && (
        <EditStopsDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          positionId={selectedPosition.id}
          currentSL={selectedPosition.sl_x6}
          currentTP={selectedPosition.tp_x6}
          entryPrice={selectedPosition.entry_x6}
          liqPrice={selectedPosition.liq_x6}
          isLong={selectedPosition.long_side}
          priceStep={selectedPosition.priceStep}
          priceDecimals={selectedPosition.priceDecimals}
          onConfirm={handleUpdateStopsLogic} 
          disabled={paymasterLoading} 
        />
      )}
    </section>
  );
};

export default PositionsSection;
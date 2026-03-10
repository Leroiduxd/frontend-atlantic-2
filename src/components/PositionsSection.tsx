"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig"; 
import { Hash } from 'viem'; 
import { usePaymaster } from "@/hooks/useBrokexPaymaster"; 
import { ChevronDown, ChevronUp, Plus, Minus, Check, X, Pencil } from 'lucide-react'; 
import { useAccount, useWriteContract } from 'wagmi';

// 🛑 NOUVEAU: On importe directement tes fonctions de calcul du marché !
import { getMarketKindFromId, getMarketStatusUTC } from "@/hooks/useopen";

// --- CONSTANTE WAD ---
const WAD = 1000000000000000000n;

// --- MAPPING DES PAIRES ---
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

// --- MAPPING DES TAILLES DE LOTS ---
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01,    // btc_usdt
    1: 0.01,     // eth_usdt
    2: 1,       // link_usdt
    3: 1000,    // doge_usdt
    5: 1,       // avax_usdt
    10: 1,      // sol_usdt
    14: 100,    // xrp_usdt
    15: 1000,   // trx_usdt
    16: 100,    // ada_usdt
    90: 10,     // sui_usdt
    5500: 0.01, // xau_usd
    5501: 0.1,  // xag_usd
};

// --- CONFIGURATION SMART CONTRACT ---
const PAYMASTER_ADDRESS = '0xC7eA1B52D20d0B4135ae5cc8E4225b3F12eA279B';

const PAYMASTER_ABI = [
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
      { "internalType": "int32", "name": "lotsToClose", "type": "int32" },
      { "internalType": "bytes", "name": "oracleProof", "type": "bytes" }
    ],
    "name": "closePositionMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "uint64", "name": "amount6", "type": "uint64" }
    ],
    "name": "addMargin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tradeId", "type": "uint256" },
      { "internalType": "uint48", "name": "newSL", "type": "uint48" },
      { "internalType": "uint48", "name": "newTP", "type": "uint48" }
    ],
    "name": "updateSLTP",
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

// 🛑 NOUVEAU: Fonction utilitaire pour calculer le Spread de sortie dynamique
// 🛑 MODIFIÉ: Fonction utilitaire pour calculer le Spread de sortie dynamique
// Elle reproduit volontairement la logique (le "bug") du Smart Contract pour être 100% synchrone.
const calculateExitSpreadDecimal = (assetId: number, isLongTrade: boolean, lotSize: number, exposuresMap: any, baseSpreadsMap: any): number => {
    try {
        const assetExpo = exposuresMap[assetId] || { longLots: "0", shortLots: "0" };
        const baseSpreadStr = baseSpreadsMap[assetId] || "0";
        
        const base = BigInt(baseSpreadStr);
        let L = BigInt(assetExpo.longLots || "0");
        let S = BigInt(assetExpo.shortLots || "0");
        const size = BigInt(Math.floor(lotSize));

        // ---------------------------------------------------------
        // REPRODUCTION EXACTE DU SMART CONTRACT
        // Dans le contrat, à la fermeture : calculateSpread(a, e, !t.isLong, false, size)
        // ---------------------------------------------------------
        const isContractLong = !isLongTrade; // Le contrat reçoit l'inverse du trade

        // Le contrat exécute : if (isLong) { ... else L -= size } else { ... else S -= size }
        if (isContractLong) {
            // Donc si on ferme un Short (isLongTrade = false), le contrat diminue les Longs
            L -= size;
        } else {
            // Et si on ferme un Long (isLongTrade = true), le contrat diminue les Shorts
            S -= size;
        }

        if (L < 0n) L = 0n;
        if (S < 0n) S = 0n;

        const numerator = L > S ? L - S : S - L;
        const denominator = L + S + 2n;

        if (denominator === 0n) {
            return Number(base) / Number(WAD);
        }

        const r = (numerator * WAD) / denominator;
        const p = (r * r) / WAD;

        // La règle de dominance telle qu'écrite dans le contrat:
        // bool dominant = (L > S && isLong) || (S > L && !isLong);
        const dominant = (L > S && isContractLong) || (S > L && !isContractLong);

        const finalSpreadWad = dominant ? (base * (WAD + 3n * p)) / WAD : base;
        return Number(finalSpreadWad) / Number(WAD);
    } catch (e) {
        console.error("Erreur de calcul du spread", e);
        return 0;
    }
};

type TabType = "openPositions" | "pendingOrders" | "closedPositions" | "cancelledOrders";

interface PositionsSectionProps {
    paymasterEnabled: boolean;
    currentAssetId: number | null;
    currentAssetSymbol?: string;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

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

// --- COMPOSANT CARTE ---
interface PositionCardProps {
    position: any; 
    isActionDisabled: boolean;
    onClose: (id: number, assetId: number, lots: number) => Promise<void>;
    onAddMargin: (id: number, amount: number) => Promise<void>;
    onUpdateStops: (id: number, newSL: bigint, newTP: bigint) => Promise<void>;
    symbolMap: any;
    getDisplaySymbol: (assetSymbol: string, assetId: number) => string; 
}

const PositionCard: React.FC<PositionCardProps> = ({ 
    position, 
    isActionDisabled, 
    onClose, 
    onAddMargin,
    onUpdateStops,
    symbolMap,
    getDisplaySymbol 
}) => {
    const maxLots = position.lots - position.closed_lots;
    const [isClosing, setIsClosing] = useState(false);
    const [lotsInput, setLotsInput] = useState(maxLots);
    
    const [isAddingMargin, setIsAddingMargin] = useState(false);
    const [marginInput, setMarginInput] = useState(10);

    const [isEditingStops, setIsEditingStops] = useState(false);
    const [slInput, setSlInput] = useState("");
    const [tpInput, setTpInput] = useState("");

    const startEditingStops = () => {
        setSlInput(position.sl_x6 > 0 ? (position.sl_x6 / 1000000).toString() : "");
        setTpInput(position.tp_x6 > 0 ? (position.tp_x6 / 1000000).toString() : "");
        setIsEditingStops(true);
    };

    const confirmEditingStops = () => {
        const newSL = slInput === "" ? 0n : BigInt(Math.floor(parseFloat(slInput) * 1e6));
        const newTP = tpInput === "" ? 0n : BigInt(Math.floor(parseFloat(tpInput) * 1e6));
        onUpdateStops(position.id, newSL, newTP);
        setIsEditingStops(false);
    };

    const isPNLPositive = position.calculatedPNL !== null && position.calculatedPNL >= 0;
    const pnlUsdText = position.calculatedPNL !== null ? position.calculatedPNL.toFixed(2) : '---';
    const roePercentText = position.calculatedROE !== null ? position.calculatedROE.toFixed(2) : '---';
    const markPriceText = position.currentPrice || '---'; 
    
    const pnlClass = isPNLPositive ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500';
    const sideClass = position.long_side 
        ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white font-bold' 
        : 'bg-red-600 text-white dark:bg-red-600 dark:text-white font-bold'; 
        
    const entryPrice = formatAssetPrice(position.entry_x6, position.asset_id, symbolMap);
    const liqPriceFormatted = position.liq_x6 > 0 ? formatAssetPrice(position.liq_x6, position.asset_id, symbolMap) : '-';
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
                    <span className="text-zinc-500 block text-[10px] uppercase font-normal">Unrealized PNL</span>
                    <div className={`font-bold text-lg ${pnlClass} leading-tight`}>
                        {isPNLPositive ? '+' : ''}{pnlUsdText} <span className="text-xs font-normal">USD</span> <span className="text-xs font-semibold">({roePercentText}%)</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-start pt-2">
                <div className="grid grid-cols-4 gap-x-6 gap-y-4 flex-grow min-w-0 pr-8">
                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Entry Price</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{entryPrice}</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Mark Price</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{markPriceText}</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Liq. Price</span>
                        <span className="text-red-600 dark:text-red-500 text-xs font-semibold block">{liqPriceFormatted}</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Size ({baseSymbol})</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{position.size}</span>
                    </div>
                    
                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Margin (USD)</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-zinc-200">{marginUsdText}</span>
                    </div>

                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-zinc-500 block text-[10px] uppercase font-normal">Stop Loss (SL)</span>
                            {!isEditingStops && !isActionDisabled && (
                                <button onClick={startEditingStops} className="text-zinc-400 hover:text-blue-500 transition-colors">
                                    <Pencil size={10}/>
                                </button>
                            )}
                        </div>
                        {!isEditingStops ? (
                            <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{slPriceFormatted}</span>
                        ) : (
                            <input 
                                type="number" 
                                value={slInput} 
                                onChange={(e) => setSlInput(e.target.value)} 
                                placeholder="0.00"
                                className="w-full h-6 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded px-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-zinc-500 block text-[10px] uppercase font-normal">Take Profit (TP)</span>
                            {!isEditingStops && !isActionDisabled && (
                                <button onClick={startEditingStops} className="text-zinc-400 hover:text-blue-500 transition-colors">
                                    <Pencil size={10}/>
                                </button>
                            )}
                        </div>
                        {!isEditingStops ? (
                            <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{tpPriceFormatted}</span>
                        ) : (
                            <div className="flex items-center gap-1">
                                <input 
                                    type="number" 
                                    value={tpInput} 
                                    onChange={(e) => setTpInput(e.target.value)} 
                                    placeholder="0.00"
                                    className="w-full h-6 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded px-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                                />
                                <button onClick={confirmEditingStops} className="text-blue-600 hover:text-blue-500 p-1 bg-blue-50 dark:bg-zinc-800 rounded"><Check size={14}/></button>
                                <button onClick={() => setIsEditingStops(false)} className="text-zinc-500 hover:text-zinc-400 p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><X size={14}/></button>
                            </div>
                        )}
                    </div>

                    <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-normal">Open Date</span>
                        <span className="text-gray-900 dark:text-zinc-200 text-xs font-semibold block">{openDate}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 min-w-[170px] ml-4 flex-shrink-0">
                    {!isClosing ? (
                        <Button
                            onClick={() => { setIsClosing(true); setLotsInput(maxLots); }}
                            disabled={isActionDisabled || isEditingStops || !position.isMarketOpen} 
                            size="sm"
                            className={`h-8 px-3 text-[12px] font-semibold border rounded-md transition duration-150 w-full 
                                bg-white border-gray-300 hover:bg-gray-50 
                                dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800
                                ${isActionDisabled || !position.isMarketOpen ? 'text-zinc-500 cursor-not-allowed' : 'text-red-600 dark:text-red-400'}`}
                            variant="outline"
                        >
                            {!position.isMarketOpen ? "Market Closed" : "Close Position"}
                        </Button>
                    ) : (
                        <div className="flex items-center justify-between h-8 bg-white dark:bg-zinc-900 border border-red-300 dark:border-red-900/50 rounded-md px-1 shadow-sm w-full">
                            <button onClick={() => setLotsInput(prev => Math.max(1, prev - 1))} className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><Minus size={14}/></button>
                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{lotsInput} Lot{lotsInput > 1 ? 's' : ''}</span>
                            <button onClick={() => setLotsInput(prev => Math.min(maxLots, prev + 1))} className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><Plus size={14}/></button>
                            <div className="flex gap-1 ml-1 border-l border-gray-200 dark:border-zinc-700 pl-1">
                                <button 
                                    onClick={() => { onClose(position.id, position.asset_id, lotsInput); setIsClosing(false); }} 
                                    className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800 rounded"
                                >
                                    <Check size={14}/>
                                </button>
                                <button 
                                    onClick={() => setIsClosing(false)} 
                                    className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                                >
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                    )}

                    {!isAddingMargin ? (
                        <Button
                            onClick={() => { setIsAddingMargin(true); setMarginInput(10); }}
                            disabled={isActionDisabled || isEditingStops}
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-[12px] font-semibold border rounded-md transition duration-150 w-full
                                bg-white border-gray-300 text-blue-600 hover:bg-gray-100
                                dark:bg-zinc-900 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-zinc-800"
                        >
                            Add Margin
                        </Button>
                    ) : (
                        <div className="flex items-center justify-between h-8 bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-900/50 rounded-md px-1 shadow-sm w-full">
                            <button onClick={() => setMarginInput(prev => Math.max(1, prev - 10))} className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><Minus size={14}/></button>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">${marginInput}</span>
                            <button onClick={() => setMarginInput(prev => prev + 10)} className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"><Plus size={14}/></button>
                            <div className="flex gap-1 ml-1 border-l border-gray-200 dark:border-zinc-700 pl-1">
                                <button 
                                    onClick={() => { onAddMargin(position.id, marginInput); setIsAddingMargin(false); }} 
                                    className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-zinc-800 rounded"
                                >
                                    <Check size={14}/>
                                </button>
                                <button 
                                    onClick={() => setIsAddingMargin(false)} 
                                    className="p-1 text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded"
                                >
                                    <X size={14}/>
                                </button>
                            </div>
                        </div>
                    )}
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
  const [filterMode, setFilterMode] = useState<"all" | "asset">("all");
  
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  // 🛑 NOUVEAU: États globaux pour le calcul du Spread et Funding
  const [exposures, setExposures] = useState<any>({});
  const [baseSpreads, setBaseSpreads] = useState<any>({});
  const [liveFundings, setLiveFundings] = useState<any>({});

  const { address } = useAccount();
  const { toast } = useToast();
  
  const { 
    executeCloseMarket, 
    executeAddMargin, 
    executeUpdateSLTP, 
    executeCancelOrder, 
    isLoading: paymasterLoading 
  } = usePaymaster();

  const { data: wsData } = useWebSocket();
  const { configs: assetConfigs } = useAssetConfig(); 
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const fetchTrades = async () => {
    if (!address) return;
    setIsLoadingTrades(true);
    try {
        const resIds = await fetch(`https://api.brokex.trade/trader/${address}/ids?state=all`);
        if (!resIds.ok) throw new Error("Failed to fetch trade IDs");
        const { ids } = await resIds.json();

        const detailPromises = ids.map((id: number) => 
            fetch(`https://api.brokex.trade/trade/${id}`).then(r => r.json())
        );
        
        const trades = await Promise.all(detailPromises);
        const validTrades = trades.filter(t => !t.error);
        setRawTrades(validTrades);

        // 🛑 NOUVEAU: Fetch simultané des données dynamiques (Exposures, Spreads)
        const [expoRes, spreadRes] = await Promise.all([
            fetch('https://api.brokex.trade/exposures'),
            fetch('https://api.brokex.trade/spreads/base')
        ]);
        const expoJson = await expoRes.json();
        const spreadJson = await spreadRes.json();
        
        if (expoJson.success) setExposures(expoJson.data);
        if (spreadJson.success) setBaseSpreads(spreadJson.data);

        // 🛑 NOUVEAU: Fetch des live Fundings uniquement pour les actifs ayant des trades ouverts
        const activeAssetIds = Array.from(new Set(validTrades.filter(t => t.state === 1).map(t => Number(t.assetId))));
        const fundingPromises = activeAssetIds.map(id => 
            fetch(`https://api.brokex.trade/funding/live/${id}`).then(r => r.json()).catch(() => null)
        );
        const fundingResults = await Promise.all(fundingPromises);
        
        const fundingsMap: any = {};
        fundingResults.forEach((res) => {
            if (res && res.success && res.data) {
                fundingsMap[res.data.assetId] = res.data;
            }
        });
        setLiveFundings(fundingsMap);

    } catch (e) {
        console.error("Error fetching trades from API:", e);
    } finally {
        setIsLoadingTrades(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [address]);

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

  const { openPositions, pendingOrders, closedPositions, cancelledOrders } = useMemo(() => {
    const open: any[] = [];
    const pending: any[] = [];
    const closed: any[] = [];
    const cancelled: any[] = [];

    rawTrades.forEach((t) => {
        const kind = getMarketKindFromId(Number(t.assetId));
        const isMarketOpen = kind ? getMarketStatusUTC(kind).isOpen : true;

        const position = {
            id: Number(t.id),
            asset_id: Number(t.assetId),
            long_side: Boolean(t.isLong), 
            is_limit: Boolean(t.isLimit),
            leverage_x: Number(t.leverage),
            entry_x6: Number(t.openPrice),
            margin_usd6: Number(t.marginUsdc),
            sl_x6: Number(t.stopLoss),
            tp_x6: Number(t.takeProfit),
            lots: Number(t.lotSize),
            closed_lots: Number(t.closedLotSize || 0), 
            created_at: Number(t.openTimestamp),
            target_x6: Number(t.openPrice),
            state: Number(t.state),
            closePriceX6: Number(t.closePrice),
            pnl_usd6: null as number | null
        };

        const assetInfo = assetSymbolMap[position.asset_id];
        const assetWs = assetMap[position.asset_id];
        
        const assetMultiplier = ASSET_LOT_SIZES[position.asset_id] || 1;
        const remainingLots = position.lots - position.closed_lots;
        const displaySize = remainingLots * assetMultiplier;

        let liqPriceX6 = 0;
        if (position.entry_x6 > 0 && position.leverage_x > 0) {
            if (position.long_side) {
                liqPriceX6 = position.entry_x6 * (1 - 0.9 / position.leverage_x);
            } else {
                liqPriceX6 = position.entry_x6 * (1 + 0.9 / position.leverage_x);
            }
        }

        const enriched = {
            ...position,
            assetSymbol: assetInfo ? assetInfo.symbol : `Asset #${position.asset_id}`,
            size: parseFloat(displaySize.toFixed(6)).toString(),
            priceDecimals: assetInfo ? assetInfo.priceDecimals : 2,
            priceStep: assetInfo ? assetInfo.priceStep : 0.01,
            currentPrice: assetWs?.currentPrice ? assetWs.currentPrice.toFixed(assetInfo?.priceDecimals || 2) : '---',
            isMarketOpen: isMarketOpen, 
            liq_x6: liqPriceX6,
            calculatedPNL: null as number | null,
            calculatedROE: null as number | null,
            orderTypeString: position.is_limit ? 'Limit' : 'Stop'
        };

        if (t.state === 1) { // OPEN
            if (assetWs?.currentPrice && position.entry_x6 > 0) {
                const currentP = assetWs.currentPrice;
                const entryP = position.entry_x6 / 1000000;
                const direction = position.long_side ? 1 : -1;
                
                // 🛑 NOUVEAU: 1. Calcul du Spread de Sortie et du Prix de Sortie exact
                const spreadDecimal = calculateExitSpreadDecimal(position.asset_id, position.long_side, position.lots, exposures, baseSpreads);
                const spreadAmount = currentP * spreadDecimal;
                const exitPrice = position.long_side ? currentP - spreadAmount : currentP + spreadAmount;
                
                // 🛑 NOUVEAU: 2. Calcul du PNL brut (Raw PNL)
                const rawPnl = displaySize * (exitPrice - entryP) * direction;

                // 🛑 NOUVEAU: 3. Calcul des Frais de Funding (Funding Fee en USD)
                let fundingFeeUsd = 0;
                const fundingInfo = liveFundings[position.asset_id];
                
                if (fundingInfo && t.fundingIndex) {
                    const currentLiveIndexStr = position.long_side ? fundingInfo.liveLongIndex : fundingInfo.liveShortIndex;
                    const currentLiveIndex = BigInt(currentLiveIndexStr || "0");
                    const tradeEntryIndex = BigInt(t.fundingIndex || "0");
                    
                    if (currentLiveIndex > tradeEntryIndex) {
                        const deltaIndexWad = currentLiveIndex - tradeEntryIndex;
                        const deltaIndexDecimal = Number(deltaIndexWad) / Number(WAD);
                        
                        // Appliquer le deltaIndex sur la valeur notionnelle de sortie
                        const exitNotional = exitPrice * displaySize;
                        fundingFeeUsd = exitNotional * deltaIndexDecimal;
                    }
                }

                // 🛑 NOUVEAU: 4. PNL Réel & ROE
                const finalPnl = rawPnl - fundingFeeUsd;
                const estimatedMargin = (displaySize * entryP) / position.leverage_x;
                const roe = estimatedMargin > 0 ? (finalPnl / estimatedMargin) * 100 : 0;
                
                enriched.calculatedPNL = finalPnl;
                enriched.calculatedROE = roe;
            }
            open.push(enriched);
        } 
        else if (t.state === 0) { pending.push(enriched); }
        else if (t.state === 2) { // CLOSED
            const closeP = position.closePriceX6 / 1000000;
            const entryP = position.entry_x6 / 1000000;
            const direction = position.long_side ? 1 : -1;
            
            const closedLots = position.closed_lots > 0 ? position.closed_lots : position.lots;
            const closedDisplaySize = closedLots * assetMultiplier;
            
            if (entryP > 0) {
                const pnl = closedDisplaySize * (closeP - entryP) * direction;
                enriched.pnl_usd6 = pnl * 1000000; 
            }

            enriched.size = parseFloat(closedDisplaySize.toFixed(6)).toString();
            closed.push(enriched);
        }
        else if (t.state === 3) { cancelled.push(enriched); }
    });

    open.sort((a, b) => b.created_at - a.created_at);
    pending.sort((a, b) => b.created_at - a.created_at);
    closed.sort((a, b) => b.created_at - a.created_at);
    cancelled.sort((a, b) => b.created_at - a.created_at);

    return { openPositions: open, pendingOrders: pending, closedPositions: closed, cancelledOrders: cancelled };

  }, [rawTrades, assetMap, assetSymbolMap, exposures, baseSpreads, liveFundings]);

  const filterList = (list: any[]) => {
    if (filterMode === "all" || currentAssetId === null) return list;
    return list.filter((p) => p.asset_id === currentAssetId);
  };

  const filteredPositions = filterList(openPositions);
  const filteredOrders = filterList(pendingOrders);
  const filteredClosedPositions = filterList(closedPositions);
  const filteredCancelledOrders = filterList(cancelledOrders);

  const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
      if (PAIR_MAP[assetId]) {
          return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
      }
      const baseSymbol = assetSymbol.split('/')[0];
      return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
  };
  
  const formatDate = (timestamp: number) => {
    try { return format(new Date(timestamp * 1000), "yyyy-MM-dd HH:mm"); } 
    catch { return "---"; }
  };

  const handleClose = async (id: number, assetId: number, lotsToClose: number) => {
    try {
        if (paymasterEnabled) {
           await executeCloseMarket({ tradeId: id, assetId, lotsToClose });
           toast({ title: "Close Request Sent", description: "Processing via Paymaster..." });
        } else {
           const proof = await getMarketProof(assetId); 
           await writeContractAsync({
               address: PAYMASTER_ADDRESS,
               abi: PAYMASTER_ABI,
               functionName: 'closePositionMarket',
               args: [BigInt(id), lotsToClose, proof]
           });
           toast({ title: "Close Order Sent", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 3000);
    } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e.message || "Failed to close.", variant: "destructive" });
    }
  };

  const handleAddMargin = async (id: number, amount: number) => {
      try {
          const amount6Num = Math.floor(amount * 1e6);
          if (paymasterEnabled) {
              await executeAddMargin({ tradeId: id, amount6: amount6Num });
              toast({ title: "Add Margin Sent", description: "Processing via Paymaster..." });
          } else {
              await writeContractAsync({
                  address: PAYMASTER_ADDRESS,
                  abi: PAYMASTER_ABI,
                  functionName: 'addMargin',
                  args: [BigInt(id), BigInt(amount6Num)]
              });
              toast({ title: "Add Margin Sent", description: "Transaction submitted." });
          }
          setTimeout(() => fetchTrades(), 3000);
      } catch (e: any) {
          console.error(e);
          toast({ title: "Error", description: e.message || "Failed to add margin.", variant: "destructive" });
      }
  };

  const handleUpdateStopsLogic = async (id: number, newSL: bigint, newTP: bigint) => { 
    try {
        if (paymasterEnabled) {
            await executeUpdateSLTP({ tradeId: id, newSL: Number(newSL), newTP: Number(newTP) });
            toast({ title: "Update Request Sent", description: "Processing via Paymaster..." });
        } else {
            await writeContractAsync({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'updateSLTP',
                args: [BigInt(id), newSL, newTP]
            });
            toast({ title: "SL/TP Updated", description: "Transaction submitted." });
        }
        setTimeout(() => fetchTrades(), 2000);
    } catch (e: any) {
        console.error(e);
        toast({ title: "Error", description: e.message || "Failed to update SL/TP.", variant: "destructive" });
    }
  };

  const handleCancelOrder = async (id: number) => { 
    try {
        if (paymasterEnabled) {
            await executeCancelOrder({ tradeId: id });
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
        <div id="positions-content" className="flex-grow p-0 overflow-y-auto bg-white dark:bg-black [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">          
          {activeTab === "openPositions" && (
              <div className="space-y-0 divide-y divide-gray-200 dark:divide-white/10">
                  {filteredPositions.length > 0 ? (
                      filteredPositions.map((position) => (
                          <PositionCard
                              key={position.id}
                              position={position}
                              isActionDisabled={isActionDisabled}
                              onClose={handleClose}
                              onAddMargin={handleAddMargin}
                              onUpdateStops={handleUpdateStopsLogic}
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
                <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">                      
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
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Size</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Entry</th>
                                <th className="px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">Close</th>
                                <th className="pr-4 pl-3 py-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-500">P&L</th>
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
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{pos.size}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{formatAssetPrice(pos.entry_x6, pos.asset_id, assetSymbolMap)}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-200">{formatAssetPrice(pos.closePriceX6, pos.asset_id, assetSymbolMap)}</td>
                                <td className={`pr-4 pl-3 py-1.5 text-right text-[11px] font-bold ${(pos.pnl_usd6 || 0) >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>{pos.pnl_usd6 ? `$${formatUSD(pos.pnl_usd6)}` : '-'}</td>
                              </tr>
                           ))}
                           {activeTab === "cancelledOrders" && filteredCancelledOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-gray-100 dark:hover:bg-zinc-900 transition duration-100">
                                <td className="pl-4 pr-3 py-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">{getDisplaySymbol(order.assetSymbol, order.asset_id)}</td>
                                <td className="px-3 py-1.5 text-[11px] text-gray-500 dark:text-zinc-400">{formatDate(order.created_at)}</td>
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

    </section>
  );
};

export default PositionsSection;
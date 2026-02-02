"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";

export interface Asset {
  id: number;
  name: string;
  symbol: string;
  pair?: string;
  currentPrice?: string;
  change24h?: string;
}

interface ChartControlsProps {
  selectedAsset: Asset;
  onAssetChange: (asset: Asset) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  priceChange: number;
  priceChangePercent: number;
  currentPrice: number;
}

const TIMEFRAMES = [
  { value: "60", label: "1m" },
  { value: "300", label: "5m" },
  { value: "900", label: "15m" },
  { value: "3600", label: "1h" },
  { value: "14400", label: "4h" },
  { value: "86400", label: "1D" },
];

const NETWORKS = [
    { name: "Atlantic", status: "Testnet", url: "https://app.brokex.trade" },
    { name: "Old Testnet", status: "Testnet", url: "https://testnet.brokex.trade" },
];

const CATEGORIES = ["all", "crypto", "forex", "commodities", "stocks", "indices"];

export const ChartControls = (props: ChartControlsProps) => {
  const { 
    selectedAsset, 
    onAssetChange, 
    selectedTimeframe, 
    onTimeframeChange, 
    currentPrice 
  } = props;
  
  const { data: wsData } = useWebSocket();
  const assetsByCat = getAssetsByCategory(wsData);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false); 
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]); 
  
  // États Persistants
  const [activeCategory, setActiveCategory] = useState("all");
  
  // État Volatile
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isPopoverOpen) {
        setSearchQuery("");
    }
  }, [isPopoverOpen]);

  const handleAssetChange = (asset: any) => {
    const normalizedId = Number(asset.id);
    const normalizedAsset: Asset = {
        id: Number.isFinite(normalizedId) ? normalizedId : -1,
        name: asset.name,
        symbol: asset.symbol,
        pair: asset.pair,
        currentPrice: asset.currentPrice,
        change24h: asset.change24h,
    };
    onAssetChange(normalizedAsset);
    setIsPopoverOpen(false);
  };

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  const filteredAssets = useMemo(() => {
    let allAssets: any[] = [];
    if (activeCategory === "all") {
        Object.values(assetsByCat).forEach(list => allAssets.push(...list));
    } else {
        allAssets = assetsByCat[activeCategory as keyof typeof assetsByCat] || [];
    }

    if (searchQuery.trim() !== "") {
        const lowerQ = searchQuery.toLowerCase();
        allAssets = allAssets.filter(a => 
            a.symbol.toLowerCase().includes(lowerQ) || 
            a.name.toLowerCase().includes(lowerQ)
        );
    }
    return allAssets;
  }, [activeCategory, assetsByCat, searchQuery]);

  const priceChange24h = parseFloat(selectedAsset.change24h || '0');
  const isPositive = priceChange24h >= 0;

  return (
    <div className="w-full h-full bg-white dark:bg-black flex items-center justify-between px-4 gap-4 transition-colors duration-300 border-b border-gray-200 dark:border-zinc-800">
      
      {/* Group 1: Asset Selector & Price Info */}
      <div className="flex items-center gap-4">
          
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 font-semibold text-base hover:bg-slate-100 dark:text-white dark:hover:bg-zinc-900 transition-colors h-12 rounded-none -ml-4 px-4"
              >
                {selectedAsset.symbol}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            
            <PopoverContent 
                className="w-[800px] h-[420px] p-0 bg-white dark:bg-black dark:border-zinc-800 shadow-2xl rounded-none border border-gray-200 mt-[1px] flex flex-col overflow-hidden" 
                align="start" 
                sideOffset={0}
            >
              
              {/* HEADER : Padding réduit (p-2) */}
              <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-black">
                  
                  {/* Liste des Catégories */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            // Style mis à jour : Gris au lieu de Noir/Blanc pour l'actif
                            className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize transition-colors
                                ${activeCategory === cat 
                                    ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white" 
                                    : "text-slate-500 hover:text-black hover:bg-slate-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900"
                                }`
                            }
                          >
                              {cat}
                          </button>
                      ))}
                  </div>

                  {/* Barre de Recherche : h-7, text-[10px], pas de loupe */}
                  <div className="w-40 flex-shrink-0 ml-2">
                      <Input 
                        placeholder="Search..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        // Style mis à jour : Fond identique au bouton actif
                        className="h-7 px-3 text-[10px] bg-slate-100 dark:bg-zinc-800 border-none focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-zinc-600 dark:text-white rounded-md"
                      />
                  </div>
              </div>
                
              {/* En-têtes de colonnes */}
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] px-4 py-2 border-b border-gray-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <div>Assets</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">24h Chg</div>
                  <div className="text-right">24h Vol.</div>
                  <div className="text-right">OI (Long)</div>
                  <div className="text-right">OI (Short)</div>
              </div>

              {/* ScrollArea avec Scrollbar Invisible */}
              <ScrollArea className="flex-1 bg-white dark:bg-black [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex flex-col">
                  {filteredAssets.length > 0 ? (
                    filteredAssets.map((asset) => {
                        const isOpen = true; 

                        return (
                          <Button
                            key={asset.id}
                            variant="ghost"
                            className={`w-full grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] h-auto py-3 px-4 rounded-none border-b border-gray-50 dark:border-zinc-900/50 transition-colors 
                                ${selectedAsset.id === asset.id 
                                    ? "bg-slate-50 dark:bg-zinc-900/80" 
                                    : "hover:bg-slate-50 dark:hover:bg-zinc-900"
                                }`}
                            onClick={() => handleAssetChange(asset)}
                          >
                            {/* Colonne 1: Logo + Symbol + Status */}
                            <div className="flex items-center gap-3 text-left">
                                {/* Logo plus grand (w-9 h-9) */}
                                <div className="w-9 h-9 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center text-[10px] text-slate-300">
                                </div>
                                
                                <div className="flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{asset.symbol}</span>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'bg-red-500'}`}></span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 truncate max-w-[80px]">{asset.name}</span>
                                </div>
                            </div>

                            <div className="text-right text-sm font-mono text-slate-900 dark:text-white self-center">
                                {formatPrice(parseFloat(asset.currentPrice || '0'))}
                            </div>

                            <div className={`text-right text-xs font-bold self-center ${parseFloat(asset.change24h || '0') >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-500'}`}>
                                {parseFloat(asset.change24h || '0') >= 0 ? '+' : ''}{parseFloat(asset.change24h || '0').toFixed(2)}%
                            </div>

                            <div className="text-right text-xs text-slate-500 dark:text-zinc-500 font-mono self-center">-</div>
                            <div className="text-right text-xs text-slate-500 dark:text-zinc-500 font-mono self-center">-</div>
                            <div className="text-right text-xs text-slate-500 dark:text-zinc-500 font-mono self-center">-</div>

                          </Button>
                        );
                    })
                  ) : (
                    <div className="text-center text-slate-400 dark:text-zinc-600 py-12 text-xs flex flex-col items-center">
                        No assets found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Price Info */}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-base text-slate-900 dark:text-white transition-colors">{formatPrice(currentPrice)}</span> 
            <span
              className={`text-sm font-semibold transition-colors ${
                isPositive ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-500"
              }`}
            >
              {isPositive ? "+" : ""}
              {priceChange24h.toFixed(2)}%
            </span>
          </div>
      </div>


      {/* Group 2: Timeframe & Network */}
      <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 rounded-md p-1 transition-colors">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant="ghost"
                size="sm"
                className={`h-7 px-3 text-xs transition-all
                    ${selectedTimeframe === tf.value 
                        ? 'font-bold bg-white text-black shadow-sm dark:bg-zinc-700 dark:text-white' 
                        : 'font-medium text-slate-500 hover:text-black dark:text-zinc-400 dark:hover:text-white'
                    }`}
                onClick={() => onTimeframeChange(tf.value)}
              >
                {tf.label}
              </Button>
            ))}
          </div>

          <Popover open={isNetworkDialogOpen} onOpenChange={setIsNetworkDialogOpen}>
              <PopoverTrigger asChild>
                  <div className="flex items-center h-12 -my-4 -mr-4 pl-4 border-l border-gray-200 dark:border-zinc-800">
                      <div
                          role="button"
                          className="flex items-center gap-2 pr-4 cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() => setIsNetworkDialogOpen(true)}
                      >
                          <img src="/icon.png" alt="Network" className="w-5 h-5 rounded-full shadow-sm" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedNetwork.name}</span>
                      </div>
                  </div>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-white dark:bg-black dark:border-zinc-800 shadow-xl rounded-none mt-[1px]" align="end" sideOffset={0}>
                  <div className="p-4 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Select Network</h4>
                      {NETWORKS.map((network) => {
                          const isCurrent = selectedNetwork.name === network.name;
                          const networkContent = (
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{network.name}</span>
                                    <span className={`text-[10px] font-medium ${isCurrent ? 'text-green-600' : 'text-blue-500 dark:text-blue-400'}`}>{network.status}</span>
                                </div>
                                {isCurrent && <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                            </div>
                          );
                          if (isCurrent) {
                              return <div key={network.name} className="p-3 rounded-none flex items-center bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 cursor-default" onClick={() => setIsNetworkDialogOpen(false)}>{networkContent}</div>;
                          } else {
                              return <a key={network.name} href={network.url} target="_blank" rel="noopener noreferrer" className="p-3 rounded-none flex items-center transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800">{networkContent}</a>;
                          }
                      })}
                  </div>
              </PopoverContent>
          </Popover>
      </div>
    </div>
  );
};
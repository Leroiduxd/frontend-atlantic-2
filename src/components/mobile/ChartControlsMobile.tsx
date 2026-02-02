"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChevronDown, Search } from "lucide-react";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from "react";

// On définit l'interface ici pour être sûr qu'elle match
export interface Asset {
  id: number;
  name: string;
  symbol: string;
  pair?: string;
  currentPrice?: string;
  change24h?: string;
}

interface ChartControlsMobileProps {
  selectedAsset: Asset;
  onAssetChange: (asset: Asset) => void;
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
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

const CATEGORIES = ["all", "crypto", "forex", "commodities", "indices"];

export const ChartControlsMobile = (props: ChartControlsMobileProps) => {
  const { 
    selectedAsset, 
    onAssetChange, 
    selectedTimeframe, 
    onTimeframeChange, 
    currentPrice 
  } = props;
  
  // Utilisation de ton hook tel quel
  const { data: wsData } = useWebSocket();
  
  // Transformation des données via ta fonction helper
  const assetsByCat = useMemo(() => getAssetsByCategory(wsData || {}), [wsData]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isSheetOpen) setSearchQuery("");
  }, [isSheetOpen]);

  const handleAssetChange = (asset: any) => {
    // On s'assure de renvoyer un objet propre
    const normalizedAsset: Asset = {
        id: Number(asset.id), // Important : ID en nombre
        name: asset.name,
        symbol: asset.symbol,
        pair: asset.pair,
        currentPrice: asset.currentPrice,
        change24h: asset.change24h,
    };
    onAssetChange(normalizedAsset);
    setIsSheetOpen(false);
  };

  const formatPrice = (value: number) => {
    if (!value && value !== 0) return "0.00";
    if (value === 0) return "0.00";
    if (value < 1) return value.toFixed(5);
    return value.toFixed(2);
  };

  const filteredAssets = useMemo(() => {
    let allAssets: any[] = [];
    
    // Agrégation selon la catégorie
    if (activeCategory === "all") {
        Object.values(assetsByCat).forEach((list: any) => allAssets.push(...list));
    } else {
        // @ts-ignore - Accès dynamique sécurisé par la logique
        allAssets = assetsByCat[activeCategory] || [];
    }

    // Filtrage recherche
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
    <div className="flex flex-col w-full bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 transition-colors duration-300">
      
      {/* LIGNE 1 : Sélecteur & Prix */}
      <div className="flex items-center justify-between px-4 py-3">
        
        {/* BOUTON D'OUVERTURE DU TIROIR */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <div className="flex items-center gap-3 cursor-pointer active:opacity-60 transition-opacity">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                        {selectedAsset.symbol ? selectedAsset.symbol.substring(0,1) : "?"}
                    </span>
                </div>
                
                <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                        <span className="font-bold text-lg text-slate-900 dark:text-white leading-none">
                            {selectedAsset.symbol}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-zinc-500 leading-none mt-1">
                        {selectedAsset.name}
                    </span>
                </div>
            </div>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-[85dvh] w-full p-0 bg-white dark:bg-black rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-col h-full">
                
                {/* Barre de Recherche */}
                <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search (BTC, Gold, EUR...)" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-11 bg-slate-100 dark:bg-zinc-900 border-none rounded-xl text-base"
                            autoFocus
                        />
                    </div>
                    
                    {/* Catégories */}
                    <div className="flex gap-2 overflow-x-auto mt-4 pb-1 no-scrollbar">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 text-xs font-bold rounded-full capitalize transition-colors
                                    ${activeCategory === cat 
                                        ? "bg-black text-white dark:bg-white dark:text-black" 
                                        : "bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-500"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Liste des actifs */}
                <ScrollArea className="flex-1">
                    <div className="flex flex-col pb-8">
                        {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => handleAssetChange(asset)}
                                className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-zinc-900/50 active:bg-slate-50 dark:active:bg-zinc-900 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-zinc-900 flex items-center justify-center">
                                        <span className="text-xs font-bold text-slate-400">{asset.symbol.substring(0,1)}</span>
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{asset.symbol}</span>
                                        <span className="text-xs text-slate-500">{asset.name}</span>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                                        {formatPrice(parseFloat(asset.currentPrice || '0'))}
                                    </span>
                                    <span className={`text-xs font-bold ${parseFloat(asset.change24h || '0') >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {parseFloat(asset.change24h || '0') >= 0 ? '+' : ''}{parseFloat(asset.change24h || '0').toFixed(2)}%
                                    </span>
                                </div>
                            </button>
                        )) : (
                            <div className="p-8 text-center text-sm text-slate-400 dark:text-zinc-600">
                                No assets found.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>

        {/* PRIX TEMPS RÉEL (DROITE) */}
        <div className="flex flex-col items-end">
            <span className="font-mono font-bold text-xl text-slate-900 dark:text-white leading-none tracking-tight">
                {formatPrice(currentPrice)}
            </span>
            <span className={`text-xs font-bold mt-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}%
            </span>
        </div>
      </div>

      {/* LIGNE 2 : Timeframes */}
      <div className="w-full overflow-x-auto no-scrollbar border-t border-gray-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/20">
        <div className="flex items-center px-4 py-2 gap-2 min-w-max">
            {TIMEFRAMES.map((tf) => (
                <button
                    key={tf.value}
                    onClick={() => onTimeframeChange(tf.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                        ${selectedTimeframe === tf.value 
                            ? 'bg-white shadow-sm text-black dark:bg-zinc-700 dark:text-white ring-1 ring-black/5 dark:ring-white/10' 
                            : 'text-slate-500 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-800'
                        }`}
                >
                    {tf.label}
                </button>
            ))}
        </div>
      </div>

    </div>
  );
};
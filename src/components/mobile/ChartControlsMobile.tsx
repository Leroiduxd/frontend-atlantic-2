"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useState, useMemo, useEffect } from "react";
import { AssetIcon } from "@/hooks/useAssetIcon"; 

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
  currentPrice: number;
  isListOpen: boolean;
  onToggleList: () => void;
}

// 1. Ajout de la catégorie "stocks" (actions)
const CATEGORIES = ["all", "crypto", "forex", "commodities", "indices", "stocks"];

// --- 1. L'EN-TÊTE (BOUTON DE SÉLECTION) ---
export const ChartControlsMobile = (props: ChartControlsMobileProps) => {
  const { selectedAsset, currentPrice, isListOpen, onToggleList } = props;
  
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains('dark');
    setIsDark(checkDark());
    const observer = new MutationObserver(() => setIsDark(checkDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const formatPrice = (value: number) => {
    if (!value && value !== 0) return "0.00";
    if (value === 0) return "0.00";
    if (value < 1) return value.toFixed(5);
    return value.toFixed(2);
  };

  const priceChange24h = parseFloat(selectedAsset.change24h || '0');
  const isPositive = priceChange24h >= 0;

  return (
    <div className="flex flex-col w-full bg-white dark:bg-black transition-colors duration-300">
      <div className="flex items-center justify-between py-3">
        
        <div className="flex items-center gap-3 cursor-pointer active:opacity-60 transition-opacity" onClick={onToggleList}>
            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center border border-slate-200 dark:border-zinc-700">
                {/* CORRECTION: Ajout de 'key' pour forcer le rafraîchissement du logo quand l'actif change */}
                <AssetIcon key={`header-${selectedAsset.id}`} assetId={selectedAsset.id} isDark={isDark} size="24px" />
            </div>
            
            <div className="flex flex-col">
                <div className="flex items-center gap-1">
                    <span className="font-bold text-lg text-slate-900 dark:text-white leading-none">
                        {selectedAsset.symbol}
                    </span>
                    {isListOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
                <span className="text-xs text-slate-500 dark:text-zinc-500 leading-none mt-1">
                    {selectedAsset.name}
                </span>
            </div>
        </div>

        <div className="flex flex-col items-end">
            <span className="font-mono font-bold text-xl text-slate-900 dark:text-white leading-none tracking-tight">
                {formatPrice(currentPrice)}
            </span>
            <span className={`text-xs font-bold mt-1 ${isPositive ? "text-blue-600 dark:text-blue-500" : "text-red-600 dark:text-red-500"}`}>
                {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}%
            </span>
        </div>
      </div>
    </div>
  );
};

// --- 2. LA LISTE DES ACTIFS ---
export const AssetSelectorMobile = ({ onAssetChange }: { onAssetChange: (asset: Asset) => void }) => {
  const { data: wsData } = useWebSocket();
  const assetsByCat = useMemo(() => getAssetsByCategory(wsData || {}), [wsData]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains('dark');
    setIsDark(checkDark());
    const observer = new MutationObserver(() => setIsDark(checkDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const formatPrice = (value: number) => {
    if (!value && value !== 0) return "0.00";
    if (value === 0) return "0.00";
    if (value < 1) return value.toFixed(5);
    return value.toFixed(2);
  };

  const filteredAssets = useMemo(() => {
    let allAssets: any[] = [];
    
    if (activeCategory === "all") {
        Object.values(assetsByCat).forEach((list: any) => allAssets.push(...list));
    } else if (activeCategory === "stocks") {
        // CORRECTION: Filtrage spécifique pour les ID entre 6000 et 6100
        const uniqueAssets = new Map();
        Object.values(assetsByCat).forEach((list: any) => {
            list.forEach((asset: any) => {
                const id = Number(asset.id);
                if (id >= 6000 && id <= 6100) {
                    uniqueAssets.set(id, asset);
                }
            });
        });
        allAssets = Array.from(uniqueAssets.values());
    } else {
        // @ts-ignore
        allAssets = assetsByCat[activeCategory] || [];
    }
    return allAssets;
  }, [activeCategory, assetsByCat]);

  const handleAssetChange = (asset: any) => {
    const normalizedAsset: Asset = {
        id: Number(asset.id),
        name: asset.name,
        symbol: asset.symbol,
        pair: asset.pair,
        currentPrice: asset.currentPrice,
        change24h: asset.change24h,
    };
    onAssetChange(normalizedAsset);
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-black transition-colors duration-300">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 px-1">Select Asset</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 text-xs font-bold rounded-full capitalize transition-colors flex-shrink-0
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

        {/* CORRECTION: Utilisation d'une simple div au lieu de ScrollArea + masquage strict des barres de scroll */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex flex-col pb-8">
                {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                    <button
                        key={asset.id}
                        onClick={() => handleAssetChange(asset)}
                        className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-zinc-900/50 active:bg-slate-50 dark:active:bg-zinc-900 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 flex items-center justify-center">
                                {/* Clé ajoutée ici aussi par sécurité */}
                                <AssetIcon key={`list-${asset.id}`} assetId={Number(asset.id)} isDark={isDark} size="24px" />
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
                            <span className={`text-xs font-bold ${parseFloat(asset.change24h || '0') >= 0 ? 'text-blue-600 dark:text-blue-500' : 'text-red-600 dark:text-red-500'}`}>
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
        </div>
    </div>
  );
};
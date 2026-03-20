import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssetIcon } from "@/hooks/useAssetIcon";
import { Asset } from "./ChartControls"; // Ajuste le chemin selon ton projet

const CATEGORIES = ["all", "crypto", "forex", "commodities", "stocks", "indices"];
const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

const formatCompactUSD = (val: number) => {
    if (val === 0) return "$0";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(val);
};

const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
};

export const AssetSelector = ({ selectedAsset, onAssetChange, isDark, assetsByCat, openTradesStats }: any) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!isPopoverOpen) setSearchQuery("");
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

    const filteredAssets = useMemo(() => {
        let allAssets: any[] = [];
        if (activeCategory === "all") {
            Object.values(assetsByCat).forEach((list: any) => allAssets.push(...list));
        } else {
            allAssets = assetsByCat[activeCategory] || [];
        }
        if (searchQuery.trim() !== "") {
            const lowerQ = searchQuery.toLowerCase();
            allAssets = allAssets.filter(a => a.symbol.toLowerCase().includes(lowerQ) || a.name.toLowerCase().includes(lowerQ));
        }
        return allAssets;
    }, [activeCategory, assetsByCat, searchQuery]);

    const getOpenInterestInUSD = (assetId: number, isLong: boolean, assetCurrentPriceStr: string) => {
        const stat = openTradesStats.find((s: any) => s.assetId === assetId && s.isLong === (isLong ? 1 : 0));
        if (!stat) return null;
        const lotSize = ASSET_LOT_SIZES[assetId] !== undefined ? ASSET_LOT_SIZES[assetId] : 1;
        const assetPrice = parseFloat(assetCurrentPriceStr || '0');
        const exposureAsset = stat.openCount * lotSize;
        const exposureUSD = exposureAsset * assetPrice;
        return `${formatCompactUSD(exposureUSD)} (${stat.avgLeverage.toFixed(1)}x)`;
    };

    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="h-full flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-zinc-900/50 rounded-none px-2 -ml-2 border-r border-transparent dark:border-zinc-800">
                    {/* Logo au carré (rounded-md) et couleur inversée (!isDark) */}
                    <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        <AssetIcon assetId={selectedAsset.id} isDark={!isDark} size="20px" />
                    </div>
                    <div className="flex flex-col items-start justify-center">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white leading-none tracking-wide">{selectedAsset.symbol}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-500 leading-none mt-1">{selectedAsset.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-zinc-500 ml-1" />
                </Button>
            </PopoverTrigger>
            
            <PopoverContent className="w-[800px] h-[420px] p-0 bg-white dark:bg-black dark:border-zinc-800 shadow-2xl rounded-none border border-gray-200 mt-[1px] flex flex-col overflow-hidden" align="start" sideOffset={0}>
                <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-black">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {CATEGORIES.map((cat) => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize transition-colors ${activeCategory === cat ? "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white" : "text-slate-500 hover:text-black hover:bg-slate-50 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-900"}`}>
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="w-40 flex-shrink-0 ml-2">
                        <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-7 px-3 text-[10px] bg-slate-100 dark:bg-zinc-800 border-none focus-visible:ring-0 placeholder:text-slate-400 dark:placeholder:text-zinc-600 dark:text-white rounded-md"/>
                    </div>
                </div>
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1.5fr] px-4 py-2 border-b border-gray-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-black text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    <div>Assets</div><div className="text-right">Price</div><div className="text-right">24h Chg</div><div className="text-right text-blue-500">OI (Long)</div><div className="text-right text-red-500">OI (Short)</div>
                </div>
                <ScrollArea className="flex-1 bg-white dark:bg-black [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="flex flex-col">
                        {filteredAssets.length > 0 ? (
                            filteredAssets.map((asset) => {
                                const isOpen = true; 
                                const longOIStr = getOpenInterestInUSD(asset.id, true, asset.currentPrice || '0');
                                const shortOIStr = getOpenInterestInUSD(asset.id, false, asset.currentPrice || '0');

                                return (
                                    <Button key={asset.id} variant="ghost" className={`w-full grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1.5fr] h-auto py-3 px-4 rounded-none border-b border-gray-50 dark:border-zinc-900/50 transition-colors ${selectedAsset.id === asset.id ? "bg-slate-50 dark:bg-zinc-900/80" : "hover:bg-slate-50 dark:hover:bg-zinc-900"}`} onClick={() => handleAssetChange(asset)}>
                                        <div className="flex items-center gap-3 text-left">
                                            {/* Logo au carré ici aussi, couleur inversée */}
                                            <div className="w-9 h-9 rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                <AssetIcon assetId={asset.id} isDark={!isDark} size="20px" />
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5"><span className="font-bold text-sm text-slate-900 dark:text-white">{asset.symbol}</span><span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'bg-red-500'}`}></span></div>
                                                <span className="text-[10px] text-slate-500 dark:text-zinc-500 truncate max-w-[80px]">{asset.name}</span>
                                            </div>
                                        </div>
                                        <div className="text-right text-sm font-mono text-slate-900 dark:text-white self-center">{formatPrice(parseFloat(asset.currentPrice || '0'))}</div>
                                        <div className={`text-right text-xs font-bold self-center ${parseFloat(asset.change24h || '0') >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                            {parseFloat(asset.change24h || '0') >= 0 ? '+' : ''}{parseFloat(asset.change24h || '0').toFixed(2)}%
                                        </div>
                                        <div className="text-right text-xs text-blue-500 font-mono self-center font-medium flex items-center justify-end gap-1">
                                            {longOIStr ? <><ArrowUp size={12} className="stroke-[3]" />{longOIStr}</> : "-"}
                                        </div>
                                        <div className="text-right text-xs text-red-500 font-mono self-center font-medium flex items-center justify-end gap-1">
                                            {shortOIStr ? <><ArrowDown size={12} className="stroke-[3]" />{shortOIStr}</> : "-"}
                                        </div>
                                    </Button>
                                );
                            })
                        ) : (<div className="text-center text-slate-400 dark:text-zinc-600 py-12 text-xs flex flex-col items-center">No assets found</div>)}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};
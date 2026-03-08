"use client";

import { useState, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useChartData } from "@/hooks/useChartData";
import { CandlestickChart, Briefcase, Trophy, Wallet, X } from "lucide-react"; 
import { Sheet, SheetContent } from "@/components/ui/sheet"; 

// Modification ici : import de AssetSelectorMobile
import { ChartControlsMobile, AssetSelectorMobile, Asset } from "./ChartControlsMobile";
import { LightweightChartMobile } from "./LightweightChartMobile";
import { WalletView } from "./WalletView"; 
import { OrderPanelMobile } from "./OrderPanelMobile"; 
import { PositionsSectionMobile } from "./PositionsSectionMobile"; 
import { LeaderboardMobile } from "./LeaderboardMobile";

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState("trade");
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [paymasterEnabled, setPaymasterEnabled] = useState(true);
  
  // Nouvel état pour gérer l'affichage de la liste des actifs
  const [isAssetListOpen, setIsAssetListOpen] = useState(false);
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 0, 
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "BTC_USD",
    currentPrice: "0",
    change24h: "0"
  });

  const [timeframe, setTimeframe] = useState("300");

  const { data: wsData } = useWebSocket();

  const currentAssetData = useMemo(() => {
    if (!wsData) return null;
    const pairData = Object.values(wsData).find((p: any) => p.id === selectedAsset.id);
    if (pairData && pairData.instruments && pairData.instruments.length > 0) {
        return {
            currentPrice: pairData.instruments[0].currentPrice,
            change24h: pairData.instruments[0]["24h_change"]
        };
    }
    return null;
  }, [wsData, selectedAsset.id]);

  const livePrice = currentAssetData 
    ? parseFloat(currentAssetData.currentPrice) 
    : parseFloat(selectedAsset.currentPrice || "0");

  const { data: chartData, loading: isLoading } = useChartData(
    isChartOpen ? selectedAsset.id : -1,
    timeframe
  );

  const chartComponent = isChartOpen ? (
    <div className="w-full h-[350px] flex-shrink-0 mb-4 border border-slate-200 dark:border-zinc-800 rounded-[4px] bg-white dark:bg-[#111] overflow-hidden flex flex-col transition-colors">
        <div className="flex items-center justify-between p-2 px-3 border-b border-slate-100 dark:border-zinc-900 transition-colors">
            <span className="font-bold text-[11px] text-slate-500 dark:text-zinc-400">{selectedAsset.symbol} Chart</span>
            <button onClick={() => setIsChartOpen(false)} className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors text-slate-400 dark:text-zinc-500">
                <X className="w-3 h-3" />
            </button>
        </div>
        <div className="flex-1 relative">
            <LightweightChartMobile 
                data={chartData || []} 
                symbol={selectedAsset.symbol}
            />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10 transition-colors">
                    <span className="text-[10px] text-blue-500 animate-pulse font-bold">UPDATING...</span>
                </div>
            )}
        </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-white dark:bg-black text-slate-900 dark:text-white overflow-hidden transition-colors">
      
      <div className="flex-1 flex flex-col min-h-0 relative">
        
        {activeTab === "trade" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-zinc-900 transition-colors">
               {/* Modification ici : passage des props de gestion de la liste */}
               <ChartControlsMobile
                selectedAsset={selectedAsset}
                currentPrice={livePrice}
                isListOpen={isAssetListOpen}
                onToggleList={() => setIsAssetListOpen(!isAssetListOpen)}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
                {/* LOGIQUE CONDITIONNELLE : Liste OU Panneau d'ordre */}
                {isAssetListOpen ? (
                    <AssetSelectorMobile 
                        onAssetChange={(asset) => {
                            setSelectedAsset(asset);
                            setIsAssetListOpen(false); // Referme la liste quand on clique
                        }} 
                    />
                ) : (
                    <OrderPanelMobile 
                        selectedAsset={selectedAsset}
                        currentPrice={livePrice}
                        paymasterEnabled={paymasterEnabled}
                        onTogglePaymaster={() => setPaymasterEnabled(!paymasterEnabled)}
                        isChartOpen={isChartOpen}
                        onToggleChart={() => setIsChartOpen(!isChartOpen)}
                        chartComponent={chartComponent}
                        onGoToWallet={() => setActiveTab("wallet")} 
                    />
                )}
            </div>
          </div>
        )}

        {activeTab === "positions" && <div className="flex-1 h-full"><PositionsSectionMobile /></div>}
        {activeTab === "leaderboard" && <div className="flex-1 h-full"><LeaderboardMobile /></div>}
        {activeTab === "wallet" && <div className="flex-1 h-full"><WalletView /></div>}
      </div>

      <div className="flex-none bg-white dark:bg-black border-t border-slate-200 dark:border-zinc-900 pb-safe transition-colors"> 
        <div className="grid grid-cols-4 h-16 items-center">
          <NavButton active={activeTab === "trade"} onClick={() => { setActiveTab("trade"); setIsAssetListOpen(false); }} icon={<CandlestickChart className="w-5 h-5" />} label="Trade" />
          <NavButton active={activeTab === "positions"} onClick={() => setActiveTab("positions")} icon={<Briefcase className="w-5 h-5" />} label="Positions" />
          <NavButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} icon={<Trophy className="w-5 h-5" />} label="Ranks" />
          <NavButton active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} icon={<Wallet className="w-5 h-5" />} label="Wallet" />
        </div>
      </div>
      
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${active ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-zinc-600"}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
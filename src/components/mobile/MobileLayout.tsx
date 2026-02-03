"use client";

import { useState, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useChartData } from "@/hooks/useChartData";
import { CandlestickChart, Briefcase, Landmark, Wallet } from "lucide-react"; 
import { Sheet, SheetContent } from "@/components/ui/sheet"; 

// Imports de tes composants mobiles (chemins relatifs)
import { ChartControlsMobile, Asset } from "./ChartControlsMobile";
import { LightweightChartMobile } from "./LightweightChartMobile";
import { WalletView } from "./WalletView"; 
import { OrderPanelMobile } from "./OrderPanelMobile"; 
import { PositionsSectionMobile } from "./PositionsSectionMobile"; 
import { VaultMobile } from "./VaultMobile";

export default function MobileLayout() {
  // --- 1. ÉTATS DE NAVIGATION & SÉLECTION ---
  const [activeTab, setActiveTab] = useState("trade");
  
  // États pour le Panel d'Ordre
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<"long" | "short">("long");
  const [paymasterEnabled, setPaymasterEnabled] = useState(true);
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    id: 1, 
    name: "Bitcoin",
    symbol: "BTC/USD",
    pair: "BTC_USD",
    currentPrice: "0",
    change24h: "0"
  });

  const [timeframe, setTimeframe] = useState("300");

  // --- 2. DONNÉES (WS & API) ---
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
    activeTab === "trade" ? selectedAsset.id : -1, 
    timeframe
  );

  // HANDLER pour ouvrir le panel
  const openOrderPanel = (side: "long" | "short") => {
    setOrderSide(side);
    setIsOrderSheetOpen(true);
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-white dark:bg-black text-slate-900 dark:text-white overflow-hidden">
      
      {/* ============================================================
          CONTENU PRINCIPAL
         ============================================================ */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        
        {/* VUE: TRADE */}
        {activeTab === "trade" && (
          <>
            {/* 1. Header (Contrôles) */}
            <div className="flex-none z-20 shadow-sm border-b border-gray-100 dark:border-zinc-800"> 
              <ChartControlsMobile
                selectedAsset={selectedAsset}
                onAssetChange={setSelectedAsset}
                selectedTimeframe={timeframe}
                onTimeframeChange={setTimeframe}
                currentPrice={livePrice}
              />
            </div>

            {/* 2. Graphique */}
            <div className="flex-1 relative w-full bg-white dark:bg-black">
              <LightweightChartMobile 
                data={chartData || []} 
                symbol={selectedAsset.symbol}
              />
              
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 z-10 pointer-events-none">
                  <span className="text-xs text-slate-500 animate-pulse font-medium">Loading chart...</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* VUE: POSITIONS */}
        {activeTab === "positions" && (
          <div className="flex-1 h-full overflow-hidden">
            <PositionsSectionMobile />
          </div>
        )}

        {/* VUE: VAULT */}
        {activeTab === "vault" && (
          <div className="flex-1 h-full overflow-hidden">
            <VaultMobile />
          </div>
        )}

        {/* VUE: WALLET */}
        {activeTab === "wallet" && (
          <div className="flex-1 h-full overflow-hidden">
            <WalletView />
          </div>
        )}
      </div>

      {/* ============================================================
          ZONE INFÉRIEURE FIXE (BOUTONS D'ORDRE + BARRE NAV)
         ============================================================ */}
      <div className="flex-none bg-white dark:bg-black border-t border-gray-200 dark:border-zinc-800 pb-safe"> 
        
        {/* A. BOUTONS LONG / SHORT (Uniquement visible sur l'onglet Trade) */}
        {activeTab === "trade" && (
          <div className="px-4 py-3 pb-2 flex gap-3">
            {/* BOUTON LONG (BLEU) */}
            <button 
              onClick={() => openOrderPanel("long")} 
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-700 text-white rounded-lg font-bold text-base shadow-sm transition-transform active:scale-[0.98]"
            >
              Long
            </button>
            
            {/* BOUTON SHORT (ROUGE) */}
            <button 
              onClick={() => openOrderPanel("short")} 
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 active:bg-red-700 text-white rounded-lg font-bold text-base shadow-sm transition-transform active:scale-[0.98]"
            >
              Short
            </button>
          </div>
        )}

        {/* B. BARRE DE NAVIGATION */}
        <div className="grid grid-cols-4 h-16 items-center">
          <NavButton active={activeTab === "trade"} onClick={() => setActiveTab("trade")} icon={<CandlestickChart className="w-5 h-5" />} label="Trade" />
          <NavButton active={activeTab === "positions"} onClick={() => setActiveTab("positions")} icon={<Briefcase className="w-5 h-5" />} label="Positions" />
          <NavButton active={activeTab === "vault"} onClick={() => setActiveTab("vault")} icon={<Landmark className="w-5 h-5" />} label="Vault" />
          <NavButton active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} icon={<Wallet className="w-5 h-5" />} label="Wallet" />
        </div>
      </div>

      {/* ============================================================
          TIROIR DE TRADING (SHEET)
         ============================================================ */}
      <Sheet open={isOrderSheetOpen} onOpenChange={setIsOrderSheetOpen}>
        <SheetContent side="bottom" className="h-[85dvh] w-full p-0 rounded-t-2xl border-t border-zinc-800 bg-white dark:bg-black">
            <OrderPanelMobile 
                selectedAsset={selectedAsset}
                currentPrice={livePrice}
                side={orderSide}
                paymasterEnabled={paymasterEnabled}
                onTogglePaymaster={() => setPaymasterEnabled(!paymasterEnabled)}
                onClose={() => setIsOrderSheetOpen(false)}
            />
        </SheetContent>
      </Sheet>
      
    </div>
  );
}

// --- Helper Button ---
function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 h-full transition-colors
        ${active 
          ? "text-slate-900 dark:text-white" 
          : "text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400"
        }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
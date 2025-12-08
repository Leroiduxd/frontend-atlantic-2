// ChartControls.tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronDown, Globe } from "lucide-react";
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

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

// 🛑 CORRECTION: Les deux réseaux sont des Testnets.
const NETWORKS = [
    { name: "Atlantic", status: "Testnet", url: "https://app.brokex.trade" },
    { name: "Old Testnet", status: "Testnet", url: "https://testnet.brokex.trade" },
];

export const ChartControls = (props: ChartControlsProps) => {
  const { 
    selectedAsset, 
    onAssetChange, 
    selectedTimeframe, 
    onTimeframeChange, 
    // 🛑 CORRECTION: priceChange et priceChangePercent ne sont pas utilisés directement ici, 
    // seule l'info 24h stockée dans selectedAsset est affichée.
    priceChange, 
    priceChangePercent, 
    currentPrice 
  } = props;
  
  const { data: wsData } = useWebSocket();
  const categories = getAssetsByCategory(wsData);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false); 
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]); 

  const handleAssetChange = (asset: any) => {
    // FIX 4: Normalization: 0 is valid, use -1 for invalid IDs.
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
    setIsDialogOpen(false);
  };

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  // 🛑 CORRECTION: Utiliser l'info 24h de l'actif sélectionné
  const priceChange24h = parseFloat(selectedAsset.change24h || '0');
  const isPositive = priceChange24h >= 0;

  return (
    // 🛑 AJOUT: z-50 pour s'assurer que cette barre est au-dessus de ChartToolbar (z-40)
    <div className="w-full h-full bg-chart-bg flex items-center justify-between px-4 gap-4">
      
      {/* Group 1: Asset Selector & Price Info */}
      <div className="flex items-center gap-4">
          {/* Asset Selector */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 font-semibold text-base hover:bg-accent"
              >
                {selectedAsset.symbol}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            
            <DialogContent className="w-[600px] h-[500px] max-w-none p-0 bg-background z-50 overflow-hidden flex flex-col">
              <Tabs defaultValue="crypto" className="w-full h-full flex flex-col">
                <TabsList className="w-full grid grid-cols-5 rounded-none border-b flex-shrink-0">
                  <TabsTrigger value="crypto" className="text-xs">Crypto</TabsTrigger>
                  <TabsTrigger value="forex" className="text-xs">Forex</TabsTrigger>
                  <TabsTrigger value="commodities" className="text-xs">Commodities</TabsTrigger>
                  <TabsTrigger value="stocks" className="text-xs">Stocks</TabsTrigger>
                  <TabsTrigger value="indices" className="text-xs">Indices</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1">
                  {/* Mapping des catégories d'actifs (inchangé) */}
                  {Object.keys(categories).map((key) => {
                    const category = key as keyof typeof categories;
                    return (
                      <TabsContent key={key} value={key} className="m-0 p-2">
                        <div className="space-y-1">
                          {categories[category].length > 0 ? (
                            categories[category].map((asset) => (
                              <Button
                                key={asset.id}
                                variant={selectedAsset.id === asset.id ? "secondary" : "ghost"}
                                className="w-full justify-between h-auto py-2"
                                onClick={() => handleAssetChange(asset)}
                              >
                                <div className="flex flex-col items-start">
                                  <span className="font-semibold text-sm">{asset.symbol}</span>
                                  <span className="text-xs text-muted-foreground">{asset.name}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-sm">{formatPrice(parseFloat(asset.currentPrice || '0'))}</span>
                                  <span className={`text-xs font-semibold ${parseFloat(asset.change24h || '0') >= 0 ? 'text-trading-blue' : 'text-trading-red'}`}>
                                    {parseFloat(asset.change24h || '0') >= 0 ? '+' : ''}{parseFloat(asset.change24h || '0').toFixed(2)}%
                                  </span>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <div className="text-center text-muted-foreground py-4">No assets available</div>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </ScrollArea>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Price Info */}
          <div className="flex items-center gap-3">
            {/* 🛑 CORRECTION: Utilisation de currentPrice passé par TradingSection (qui est le prix du tick ou agrégé) */}
            <span className="font-semibold text-base">{formatPrice(currentPrice)}</span> 
            <span
              className={`text-sm font-semibold ${
                isPositive ? "text-trading-blue" : "text-trading-red"
              }`}
            >
              {isPositive ? "+" : ""}
              {priceChange24h.toFixed(2)}%
            </span>
          </div>
      </div>


      {/* Group 2: Timeframe Selector & Network Selector (Right Side) */}
      <div className="flex items-center gap-4">
          
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-muted rounded-md p-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant={selectedTimeframe === tf.value ? "secondary" : "ghost"}
                size="sm"
                // AJOUT DU GRAS POUR LA SÉLECTION
                className={`h-7 px-3 text-xs ${selectedTimeframe === tf.value ? 'font-bold' : 'font-medium'}`}
                onClick={() => onTimeframeChange(tf.value)}
              >
                {tf.label}
              </Button>
            ))}
          </div>

          {/* NOUVEAU: Network Selector */}
          <Dialog open={isNetworkDialogOpen} onOpenChange={setIsNetworkDialogOpen}>
              <DialogTrigger asChild>
                  {/* 🛑 MODIFICATION: Utilisation d'un conteneur Flexbox pour centrer le séparateur */}
                  <div className="flex items-center h-12 -my-4 -mr-4">
                       
                      {/* 🛑 NOUVEAU: Le trait séparateur vertical qui ne touche pas les bords */}
                      <div className="h-6 w-px bg-border mr-4"></div>

                      {/* 🛑 Zone cliquable du Network Selector */}
                      <div
                          role="button" // Rendre le div cliquable et accessible
                          aria-label="Select Network"
                          onClick={() => setIsNetworkDialogOpen(true)}
                          // 🛑 NOUVELLES CLASSES: Fond transparent (bg-chart-bg) et padding pour compenser le -mr-4
                          className="flex items-center gap-2 pr-4 cursor-pointer transition-colors"
                      >
                          {/* Icône du réseau */}
                          <img 
                              src="public/icon.png" 
                              alt="Network Icon" 
                              className="w-4 h-4 rounded-full" 
                          />
                          {/* Nom du réseau */}
                          <span className="text-xs font-semibold text-primary"> 
                              {selectedNetwork.name}
                          </span>
                      </div>
                  </div>
              </DialogTrigger>
              <DialogContent className="w-[300px] p-0 bg-background">
                  <div className="p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase">Network Status</h4>
                      
                      {NETWORKS.map((network) => {
                          const isCurrent = selectedNetwork.name === network.name;

                          const networkContent = (
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-col items-start">
                                    <span className="font-semibold">{network.name}</span>
                                    <span className={`text-xs text-trading-blue`}>
                                        {network.status}
                                    </span>
                                </div>
                                
                                {isCurrent ? (
                                    <span className="text-xs text-green-500 font-medium">
                                        Current
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground hover:underline">
                                        app.brokex.trade
                                    </span>
                                )}
                            </div>
                          );

                          if (isCurrent) {
                              // 🛑 Action: Fermer la modale (onClick est appelé par le onOpenChange de la Dialog)
                              return (
                                  <div
                                      key={network.name}
                                      className={`p-3 rounded-lg flex items-center cursor-pointer transition-colors bg-accent border border-trading-blue`}
                                      onClick={() => setIsNetworkDialogOpen(false)} 
                                  >
                                      {networkContent}
                                  </div>
                              );
                          } else {
                              // 🛑 Action: Naviguer vers l'autre Testnet
                              return (
                                  <a
                                      key={network.name}
                                      href={network.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`p-3 rounded-lg flex items-center cursor-pointer transition-colors hover:bg-muted`}
                                  >
                                      {networkContent}
                                  </a>
                              );
                          }
                      })}
                  </div>
              </DialogContent>
          </Dialog>
      </div>
    </div>
  );
};
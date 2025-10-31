import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronDown } from "lucide-react";
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

export const ChartControls = ({
  selectedAsset,
  onAssetChange,
  selectedTimeframe,
  onTimeframeChange,
  priceChange,
  priceChangePercent,
  currentPrice,
}: ChartControlsProps) => {
  const { data: wsData } = useWebSocket();
  const categories = getAssetsByCategory(wsData);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAssetChange = (asset: Asset) => {
    onAssetChange(asset);
    setIsDialogOpen(false);
  };

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };

  const isPositive = priceChange >= 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 bg-chart-bg border-t border-border flex items-center justify-between px-4 gap-4">
      {/* Asset Selector - UTILISE MAINTENANT DIALOG */}
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
        
        {/* MODIFICATION ICI : Ajout de 'overflow-hidden' au DialogContent */}
        <DialogContent className="w-[600px] h-[500px] max-w-none p-0 bg-background z-50 overflow-hidden flex flex-col">
          <Tabs defaultValue="crypto" className="w-full h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-5 rounded-none border-b flex-shrink-0">
              <TabsTrigger value="crypto" className="text-xs">Crypto</TabsTrigger>
              <TabsTrigger value="forex" className="text-xs">Forex</TabsTrigger>
              <TabsTrigger value="commodities" className="text-xs">Commodities</TabsTrigger>
              <TabsTrigger value="stocks" className="text-xs">Stocks</TabsTrigger>
              <TabsTrigger value="indices" className="text-xs">Indices</TabsTrigger>
            </TabsList>
            {/* ScrollArea a déjà 'flex-1' donc il prendra l'espace restant */}
            <ScrollArea className="flex-1">
              <TabsContent value="crypto" className="m-0 p-2">
                <div className="space-y-1">
                  {categories.crypto.length > 0 ? (
                    categories.crypto.map((asset) => (
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
              {/* FOREX TabContent */}
              <TabsContent value="forex" className="m-0 p-2">
                <div className="space-y-1">
                  {categories.forex.length > 0 ? (
                    categories.forex.map((asset) => (
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

              {/* COMMODITIES TabContent */}
              <TabsContent value="commodities" className="m-0 p-2">
                <div className="space-y-1">
                  {categories.commodities.length > 0 ? (
                    categories.commodities.map((asset) => (
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

              {/* STOCKS TabContent */}
              <TabsContent value="stocks" className="m-0 p-2">
                <div className="space-y-1">
                  {categories.stocks.length > 0 ? (
                    categories.stocks.map((asset) => (
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
              
              {/* INDICES TabContent */}
              <TabsContent value="indices" className="m-0 p-2">
                <div className="space-y-1">
                  {categories.indices.length > 0 ? (
                    categories.indices.map((asset) => (
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
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
      {/* Fin de la section Dialog */}

      {/* Price Info */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-base">{formatPrice(currentPrice)}</span>
        <span
          className={`text-sm font-semibold ${
            isPositive ? "text-trading-blue" : "text-trading-red"
          }`}
        >
          {isPositive ? "+" : ""}
          {parseFloat(selectedAsset.change24h || '0').toFixed(2)}%
        </span>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-1">
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf.value}
            variant={selectedTimeframe === tf.value ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => onTimeframeChange(tf.value)}
          >
            {tf.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
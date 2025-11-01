import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault"; 
import { useToast } from "@/hooks/use-toast";
import { DepositDialog } from "./DepositDialog";
import { Asset } from "./ChartControls";
import { useAssetConfig } from "@/hooks/useAssetConfig";
// Wagmi/Viem Imports pour la transaction manuelle
import { useAccount, useSimulateContract, useWriteContract, useConfig } from 'wagmi'; 
import { Landmark, Send } from "lucide-react"; 
import { ChevronUp, ChevronDown } from "lucide-react"; 

// --- ABI du Contrat Trading (intégré pour le débogage) ---
const TRADING_ADDRESS = '0x04a7cdf3b3aff0a0f84a94c48095d84baa91ec11' as const;
const TRADING_ABI = [
  {
    inputs: [
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'bool', name: 'isLimit', type: 'bool' },
      { internalType: 'int64', name: 'priceX6', type: 'int64' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'open',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
// ---------------------------------------------------

// ====================================================================
// COMPOSANT : StepController (Inchangé)
// ====================================================================
interface StepControllerProps {
    value: string | number;
    onChange: (value: number) => void;
    step: number;
    min?: number;
    max?: number;
    decimals?: number;
    label: string;
    unit: string;
}
const StepController: React.FC<StepControllerProps> = ({ 
    value, onChange, step, min = 0, max = Infinity, decimals = 2,
}) => {
    const numericValue = Number(value);
    const handleStep = (delta: number) => {
        const newValue = Math.min(max, Math.max(min, numericValue + delta));
        onChange(Number(newValue.toFixed(decimals)));
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
            onChange(val); 
        }
    };
    return (
        <div className="relative flex items-center">
            <Input
                type="number"
                placeholder="0.00"
                value={value}
                onChange={handleInputChange}
                className={`w-full text-lg font-medium pr-10`} 
                step={step} min={min} max={max}
            />
            <div className="absolute right-0 top-0 h-full flex flex-col justify-center border-l border-border">
                <Button variant="ghost" size="icon" className="h-1/2 w-8 p-0 border-b border-border/80 rounded-none rounded-tr-sm" onClick={() => handleStep(step)}>
                    <ChevronUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-1/2 w-8 p-0 rounded-none rounded-br-sm" onClick={() => handleStep(-step)}>
                    <ChevronDown className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
// ====================================================================


type OrderType = "limit" | "market";

interface OrderPanelProps {
  selectedAsset: Asset;
  currentPrice: number;
}

const OrderPanel = ({ selectedAsset, currentPrice }: OrderPanelProps) => {
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [leverage, setLeverage] = useState(10);
  const [lotsDisplay, setLotsDisplay] = useState(0.01); 
  const [limitPrice, setLimitPrice] = useState('');
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🛑 Récupération de 'available' (solde disponible)
  const { balance, available, locked, refetchAll, tokenBalance } = useVault(); 
  const { toast } = useToast();
  const { getConfigById, convertDisplayToLots } = useAssetConfig(); 
  
  // Hooks Wagmi pour la transaction manuelle
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  const publicClient = config.publicClient; 
  
  const finalAssetIdForTx = useMemo(() => {
    return Number(selectedAsset.id) || 0; 
  }, [selectedAsset.id]);

  const assetConfig = getConfigById(finalAssetIdForTx); 

  const { minLotSizeDisplay, lotStep, priceDecimals, priceStep } = useMemo(() => {
    const num = assetConfig?.lot_num || 1;
    const den = assetConfig?.lot_den || 100;
    const lotSize = num / den;
    const lotStep = lotSize; 
    
    const tickSizeX6 = assetConfig?.tick_size_usd6 || 10000; 
    const powerOfTen = Math.round(Math.log10(1000000 / tickSizeX6)); 
    const decimals = Math.max(0, powerOfTen); 
    const step = 1 / (10 ** decimals); 

    return {
      minLotSizeDisplay: lotSize,
      lotStep: lotStep,
      priceDecimals: decimals,
      priceStep: step,
    };
  }, [assetConfig]);


  useEffect(() => {
    setLotsDisplay(minLotSizeDisplay); 
    if (currentPrice > 0 && selectedAsset.id) {
      setLimitPrice(currentPrice.toFixed(priceDecimals));
    }
  }, [selectedAsset.id, currentPrice, minLotSizeDisplay, priceDecimals]); 

  
  const handleLotsChange = (value: number) => {
    setLotsDisplay(value);
  };
  
  // Calculs (inchangés)
  const calculations = useMemo(() => {
    const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;
    const displayNotional = lotsDisplay * price; 
    
    const liqPriceLong = price * (1 - 0.99 / leverage);
    const liqPriceShort = price * (1 + 1/ leverage);

    return {
      value: displayNotional,
      cost: displayNotional / leverage, // Marge nécessaire (coût)
      liqPriceLong,
      liqPriceShort,
    };
  }, [lotsDisplay, leverage, limitPrice, currentPrice, orderType, selectedAsset.id, getConfigById, convertDisplayToLots]);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    const integerPart = Math.floor(Math.abs(value)).toString().length;
    if (integerPart === 1) return value.toFixed(5);
    if (integerPart === 2) return value.toFixed(3);
    return value.toFixed(2);
  };


  const handleTrade = async (longSide: boolean) => {
    
    // 1. VÉRIFICATION CRITIQUE DE L'ACTIF
    if (finalAssetIdForTx === 0) {
        return toast({
            title: 'Erreur de Configuration',
            description: `Veuillez sélectionner une paire valide.`,
            variant: "destructive",
        });
    }

    // 🛑 2. NOUVELLE VÉRIFICATION : SOLDE DISPONIBLE
    const requiredMargin = calculations.cost;
    const requiredMarginWithBuffer = requiredMargin * 1.05; // Marge + 5%
    const availableBalance = Number(available); // S'assurer que 'available' est un nombre

    if (availableBalance < requiredMarginWithBuffer) {
        return toast({
            title: 'Insufficient balance',
            description: `Insufficient available balance to cover the position's cost (margin) (Estimated Cost: $${formatPrice(requiredMarginWithBuffer)}).`,
            variant: "destructive",
        });
    }

    // 3. VALIDATION SL/TP
    const entryPrice = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;
    const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;
    const liqPrice = longSide ? price * (1 - 0.99 / leverage) : price * (1 + 0.99 / leverage);

    if (slEnabled) {
      const sl = Number(slPrice);
      if ((longSide && sl <= liqPrice) || (!longSide && sl >= liqPrice)) {
        return toast({
          title: 'Validation Error',
          description: `Stop Loss must be safer than the Estimated Liquidation Price (${formatPrice(liqPrice)})`,
          variant: "destructive",
        });
      }
      if ((longSide && sl >= entryPrice) || (!longSide && sl <= entryPrice)) {
        return toast({
          title: 'Validation Error',
          description: `Stop Loss must be below Entry Price for Long or above for Short.`,
          variant: "destructive",
        });
      }
    }

    if (tpEnabled) {
      const tp = Number(tpPrice);
      if ((longSide && tp <= entryPrice) || (!longSide && tp >= entryPrice)) {
        return toast({
          title: 'Validation Error',
          description: `Take Profit must be above Entry Price for Long or below for Short.`,
          variant: "destructive",
        });
      }
    }
    // FIN VALIDATION


    setLoading(true);
    try {
      const isLimit = orderType === 'limit';
      const priceX6 = isLimit && limitPrice ? Math.round(Number(limitPrice) * 1000000) : 0;
      const slX6 = slEnabled && slPrice ? Math.round(Number(slPrice) * 1000000) : 0;
      const tpX6 = tpEnabled && tpPrice ? Math.round(Number(tpPrice) * 1000000) : 0;
      
      const actualLots = convertDisplayToLots(lotsDisplay, finalAssetIdForTx);

      // 4. ENVOI DE LA TRANSACTION
      const txHash = await writeContractAsync({ 
        address: TRADING_ADDRESS,
        abi: TRADING_ABI,
        functionName: 'open',
        args: [
            finalAssetIdForTx, 
            longSide,
            leverage,
            actualLots,
            isLimit,
            BigInt(priceX6), 
            BigInt(slX6),     
            BigInt(tpX6)      
        ],
      });
      
      if (!publicClient) {
          console.error("Wagmi public client is unavailable. Cannot wait for transaction receipt.");
      } else {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      const explorerUrl = `https://atlantic.pharosscan.xyz/tx/${txHash}`;

      toast({
        title: 'Order placed',
        description: (
          <span className="flex items-center space-x-1">
            <span>{longSide ? 'Buy' : 'Sell'} order placed successfully.</span>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-trading-blue underline flex items-center">
              View Transaction <Send className="w-3 h-3 ml-1" />
            </a>
          </span>
        ),
      });

      setLimitPrice(currentPrice.toFixed(priceDecimals)); 
      setTpPrice('');
      setSlPrice('');
      setTpEnabled(false);
      setSlEnabled(false);
      setLotsDisplay(minLotSizeDisplay);

      setTimeout(() => refetchAll(), 2000);
    } catch (error: any) {
      toast({
        title: 'Order failed',
        description: error?.message || 'Transaction failed',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-[320px] h-full flex flex-col border-l border-border shadow-md bg-card">
      
      {/* Order Panel Content (Scrollable) */}
      <div className="flex-grow p-4 space-y-5 overflow-y-auto custom-scrollbar">
        {/* 1. Tabs (Limit, Market) and Leverage */}
        <div className="flex justify-between items-center border-b border-border text-muted-foreground font-medium text-sm pt-1 pb-2">
          <div className="flex">
            <div
              className={`py-1 mr-4 cursor-pointer transition duration-150 ${
                orderType === "limit"
                  ? "text-foreground border-b-2 border-foreground"
                  : "hover:text-foreground"
              }`}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </div>
            <div
              className={`py-1 mr-4 cursor-pointer transition duration-150 ${
                orderType === "market"
                  ? "text-foreground border-b-2 border-foreground"
                  : "hover:text-foreground"
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={leverage}
              onChange={(e) => setLeverage(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-16 h-6 text-xs p-1 text-center"
              min="1"
              max="100"
            />
            <span className="text-xs font-semibold text-foreground">x</span>
          </div>
        </div>

        {/* 2. Limit Price Input */}
        {orderType === "limit" && (
          <div>
            <span className="text-light-text text-xs block mb-1">Limit Price (USD)</span>
            <StepController 
                value={limitPrice}
                onChange={setLimitPrice}
                step={priceStep}
                decimals={priceDecimals}
                label="Price"
                unit="USD"
            />
          </div>
        )}

        {/* 3. Amount Input (Lots) */}
        <div>
          <span className="text-light-text text-xs block mb-1">
            Lots ({selectedAsset.symbol.split('/')[0] || 'BTC'})
          </span>
          <StepController 
              value={lotsDisplay}
              onChange={handleLotsChange}
              step={lotStep}
              min={minLotSizeDisplay}
              decimals={lotStep >= 1 ? 0 : 2} 
              label="Lots"
              unit={selectedAsset.symbol.split('/')[0] || 'BTC'}
          />
        </div>

        {/* 4. Take Profit / Stop Loss (Utiliser StepController) */}
        <div className="space-y-3">
          {/* Take Profit Toggle */}
          <div>
            <label className="flex items-center text-foreground cursor-pointer mb-2">
              <Checkbox
                checked={tpEnabled}
                onCheckedChange={(checked) => setTpEnabled(checked as boolean)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Take Profit</span>
            </label>
            {tpEnabled && (
              <StepController 
                  value={tpPrice}
                  onChange={setTpPrice}
                  step={priceStep}
                  decimals={priceDecimals}
                  label="TP Price"
                  unit="USD"
              />
            )}
          </div>

          {/* Stop Loss Toggle */}
          <div>
            <label className="flex items-center text-foreground cursor-pointer mb-2">
              <Checkbox
                checked={slEnabled}
                onCheckedChange={(checked) => setSlEnabled(checked as boolean)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Stop Loss</span>
            </label>
            {slEnabled && (
              <StepController 
                  value={slPrice}
                  onChange={setSlPrice}
                  step={priceStep}
                  decimals={priceDecimals}
                  label="SL Price"
                  unit="USD"
              />
            )}
          </div>
        </div>

        {/* 5. Buy / Sell Buttons */}
        <div className="flex space-x-3 pt-2 pb-3">
          <Button
            onClick={() => handleTrade(true)}
            disabled={loading}
            className="flex-1 bg-trading-blue hover:bg-trading-blue/90 text-white font-bold shadow-md"
          >
            {loading ? 'Processing...' : 'Buy'}
          </Button>
          <Button
            onClick={() => handleTrade(false)}
            disabled={loading}
            className="flex-1 bg-trading-red hover:bg-trading-red/90 text-white font-bold shadow-md"
          >
            {loading ? 'Processing...' : 'Sell'}
          </Button>
        </div>

        {/* 6. Account Details (Calculations) */}
        <div className="text-xs space-y-1.5 pt-3 border-t border-border">
          <div className="flex justify-between text-light-text">
            <span>Value</span>
            <span className="text-foreground">${formatPrice(calculations.value)}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Cost (Margin)</span>
            <span className="text-foreground">${formatPrice(calculations.cost)}</span>
          </div>
          <div className="flex justify-between text-light-text">
            <span>Est. Liq. Price (Long/Short)</span>
            <span className="text-foreground text-[10px]">
              ${formatPrice(calculations.liqPriceLong)} / ${formatPrice(calculations.liqPriceShort)}
            </span>
          </div>
        </div>
      </div>
      
      {/* 7. Deposit Info (Landmark Panel) - Hauteur 200px */}
      <div className="flex-shrink-0 mx-4 mt-2 mb-4 p-4 h-[200px] bg-blue-50 rounded-lg relative overflow-hidden">
        
        {/* Logo de banque en fond (Landmark) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[33%]">
            <Landmark className="w-48 h-48 text-blue-200 opacity-70" />
        </div>
        
        {/* Contenu - Aligné à droite */}
        <div className="relative z-10 flex flex-col items-end w-full h-full justify-between">
          
          {/* Informations (Haut à droite) */}
          <div className="text-xs space-y-1.5 pt-1">
              <div className="flex justify-between items-center w-full">
                <span className="text-light-text min-w-[80px] text-right">Total Balance:</span>
                <span className="font-semibold text-foreground">${balance}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <span className="text-light-text min-w-[80px] text-right">Available:</span>
                <span className="font-semibold text-foreground">${available}</span>
              </div>
              <div className="flex justify-between items-center w-full">
                <span className="text-light-text min-w-[80px] text-right">Locked Margin:</span>
                <span className="font-semibold text-foreground">${locked}</span>
              </div>
          </div>

          {/* Bouton Deposit (Bas à droite) */}
          <div className="w-full flex justify-end">
            <DepositDialog />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPanel;
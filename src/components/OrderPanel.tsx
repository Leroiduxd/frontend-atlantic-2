import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault"; 
import { useToast } from "@/hooks/use-toast";
import { DepositDialog } from "./DepositDialog";
import { Asset } from "./ChartControls";
import { useAssetConfig } from "@/hooks/useAssetConfig";
// Wagmi/Viem Imports
import { useWriteContract, useConfig } from 'wagmi'; 
import { Landmark, Send } from "lucide-react"; 
import { ChevronUp, ChevronDown } from "lucide-react"; 
import { Hash } from 'viem'; // Importation du type Hash de viem

// --- CONSTANTES GLOBALES (Assurez-vous que celles-ci sont correctement importées ou déclarées) ---
const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11' as const;
const TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b' as const;
const TRADING_ADDRESS = '0xb449fd01fa7937d146e867b995c261e33c619292' as const;
const TRADING_ABI = [
  {
    inputs: [
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'int64', name: 'targetX6', type: 'int64' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'openLimit',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'proof', type: 'bytes' },
      { internalType: 'uint32', name: 'assetId', type: 'uint32' },
      { internalType: 'bool', name: 'longSide', type: 'bool' },
      { internalType: 'uint16', name: 'leverageX', type: 'uint16' },
      { internalType: 'uint16', name: 'lots', type: 'uint16' },
      { internalType: 'int64', name: 'slX6', type: 'int64' },
      { internalType: 'int64', name: 'tpX6', type: 'int64' },
    ],
    name: 'openMarket',
    outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
// ---------------------------------------------------

// ====================================================================
// COMPOSANT : StepController (Inchangé)
// ====================================================================
interface StepControllerProps {
    value: string | number;
    onChange: (value: any) => void;
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
        const val = e.target.value; 
        onChange(val); 
    };
    return (
        <div className="relative flex items-center">
            <Input
                type="text" 
                placeholder="0.00"
                value={value}
                onChange={handleInputChange}
                className={`w-full text-lg font-medium pr-10`} 
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

// 🛑 FONCTION UTILITAIRE : Récupérer la Preuve (plus robuste)
const getMarketProof = async (assetId: number): Promise<Hash> => {
    const url = `https://proof.brokex.trade/proof?pairs=${assetId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch proof for asset ${assetId}. Status: ${response.status}`);
    }

    const data = await response.json();
    const proof = data.proof as string;

    if (!proof || proof.length <= 2 || !proof.startsWith('0x')) {
         throw new Error("Invalid proof received from API.");
    }

    // Retourne le type Hash de viem qui est `0x${string}`
    return proof as Hash; 
};

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
  
  const { balance, available, locked, refetchAll } = useVault(); 
  const { toast } = useToast();
  const { getConfigById, convertDisplayToLots } = useAssetConfig(); 
  
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  const publicClient = config.publicClient; 
  
  const finalAssetIdForTx = useMemo(() => {
    return Number(selectedAsset.id) || 0; 
  }, [selectedAsset.id]);

  const assetConfig = getConfigById(finalAssetIdForTx); 

  const { minLotSizeDisplay, lotStep, priceDecimals, priceStep } = useMemo(() => {
    // Logique de calcul du lotStep et priceStep
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
        // Mise à jour de limitPrice uniquement si on est sur Limit au montage
        if (orderType === 'limit') {
            setLimitPrice(currentPrice.toFixed(priceDecimals));
        }
    }
  }, [selectedAsset.id, currentPrice, minLotSizeDisplay, priceDecimals, orderType]); 

  
  const handleLotsChange = (value: number) => {
    setLotsDisplay(value);
  };
  
  const calculations = useMemo(() => {
    // Utiliser le prix actuel si ordre Market
    const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;
    
    // Si le prix n'est pas valide (ex: initialisation), éviter les calculs
    if (isNaN(price) || price <= 0 || lotsDisplay <= 0) {
        return { value: 0, cost: 0, liqPriceLong: 0, liqPriceShort: 0 };
    }

    const displayNotional = lotsDisplay * price; 
    
    // La liq price est calculée par rapport au prix d'entrée
    const liqPriceLong = price * (1 - 0.99 / leverage);
    const liqPriceShort = price * (1 + 0.99 / leverage); // Correction de la formule de liq short

    return {
      value: displayNotional,
      cost: displayNotional / leverage, 
      liqPriceLong,
      liqPriceShort,
    };
  }, [lotsDisplay, leverage, limitPrice, currentPrice, orderType, priceDecimals]);

  const formatPrice = (value: number) => {
    if (value === 0) return "0.00";
    return value.toFixed(priceDecimals > 5 ? 5 : priceDecimals || 2); 
  };


  const handleTrade = async (longSide: boolean) => {
    
    // --- 1. VÉRIFICATIONS CRITIQUES ---
    if (finalAssetIdForTx === 0) {
        return toast({ title: 'Erreur de Configuration', description: `Veuillez sélectionner une paire valide.`, variant: "destructive", });
    }
    
    const numLimitPrice = Number(limitPrice);
    const numSlPrice = Number(slPrice);
    const numTpPrice = Number(tpPrice);
    
    if (orderType === 'limit' && (isNaN(numLimitPrice) || numLimitPrice <= 0)) {
        return toast({ title: 'Erreur de Saisie', description: 'Veuillez saisir un Prix Limite valide.', variant: "destructive" });
    }
    // Validation du lot
    if (lotsDisplay < minLotSizeDisplay) {
        return toast({ title: 'Erreur de Saisie', description: `Le montant minimum est ${minLotSizeDisplay}.`, variant: "destructive" });
    }

    // VÉRIFICATION : SOLDE DISPONIBLE
    const requiredMargin = calculations.cost;
    const requiredMarginWithBuffer = requiredMargin * 1.01; // Marge + 1%
    const availableBalance = Number(available); 

    if (availableBalance < requiredMarginWithBuffer) {
        return toast({
            title: 'Solde Insuffisant',
            description: `Marge requise: $${formatPrice(requiredMarginWithBuffer)}. Disponible: $${availableBalance}.`,
            variant: "destructive",
        });
    }

    // 2. VALIDATION SL/TP
    const entryPrice = orderType === 'limit' ? numLimitPrice : currentPrice;
    const liqPrice = longSide 
        ? entryPrice * (1 - 0.99 / leverage) 
        : entryPrice * (1 + 0.99 / leverage);

    if (slEnabled && (isNaN(numSlPrice) || numSlPrice <= 0)) {
        return toast({ title: 'Erreur de Saisie', description: 'Veuillez saisir un Prix Stop Loss valide.', variant: "destructive" });
    }
    if (tpEnabled && (isNaN(numTpPrice) || numTpPrice <= 0)) {
        return toast({ title: 'Erreur de Saisie', description: 'Veuillez saisir un Prix Take Profit valide.', variant: "destructive" });
    }

    if (slEnabled) {
      if ((longSide && numSlPrice <= liqPrice) || (!longSide && numSlPrice >= liqPrice)) {
        return toast({ title: 'Validation Error', description: `SL doit être plus sécuritaire que le Prix de Liq. Estimé (${formatPrice(liqPrice)})`, variant: "destructive" });
      }
      if ((longSide && numSlPrice >= entryPrice) || (!longSide && numSlPrice <= entryPrice)) {
        return toast({ title: 'Validation Error', description: `SL doit être sous le prix d'entrée pour Long ou au-dessus pour Short.`, variant: "destructive" });
      }
    }

    if (tpEnabled) {
      if ((longSide && numTpPrice <= entryPrice) || (!longSide && numTpPrice >= entryPrice)) {
        return toast({ title: 'Validation Error', description: `TP doit être au-dessus du prix d'entrée pour Long ou en-dessous pour Short.`, variant: "destructive" });
      }
    }
    // FIN VALIDATION


    setLoading(true);
    let txHash: Hash | undefined; // Déclaration de txHash avec le type Hash de viem

    try {
      // Préparation des arguments en X6
      const slX6 = slEnabled ? Math.round(numSlPrice * 1000000) : 0;
      const tpX6 = tpEnabled ? Math.round(numTpPrice * 1000000) : 0;
      const actualLots = convertDisplayToLots(lotsDisplay, finalAssetIdForTx);
      
      // 3. LOGIQUE D'ENVOI DE TRANSACTION SÉPARÉE
      if (orderType === 'limit') {
        const targetX6 = Math.round(numLimitPrice * 1000000);

        txHash = await writeContractAsync({ 
            address: TRADING_ADDRESS,
            abi: TRADING_ABI,
            functionName: 'openLimit',
            args: [
                finalAssetIdForTx, 
                longSide,
                leverage,
                actualLots,
                BigInt(targetX6), 
                BigInt(slX6),     
                BigInt(tpX6)      
            ],
        });

      } else { // Market Order
        // RÉCUPÉRATION DE LA PREUVE (Doit être la première chose pour Market!)
        const proof = await getMarketProof(finalAssetIdForTx);

        txHash = await writeContractAsync({ 
            address: TRADING_ADDRESS,
            abi: TRADING_ABI,
            functionName: 'openMarket',
            args: [
                proof, // Le type Hash (0x...) est utilisé directement
                finalAssetIdForTx, 
                longSide,
                leverage,
                actualLots,
                BigInt(slX6),     
                BigInt(tpX6)      
            ],
        });
      }
      
      // 4. ATTENDRE LA CONFIRMATION
      if (!publicClient || !txHash) {
          console.error("Wagmi public client is unavailable or txHash missing.");
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

      // Réinitialisation de l'interface
      setLimitPrice(currentPrice.toFixed(priceDecimals)); 
      setTpPrice('');
      setSlPrice('');
      setTpEnabled(false);
      setSlEnabled(false);
      setLotsDisplay(minLotSizeDisplay);

      setTimeout(() => refetchAll(), 2000);
    } catch (error: any) {
        console.error("Trade Error:", error);
        let errorMsg = error?.message || 'Transaction failed.';

        // Tentative d'extraire un message plus clair pour un Revert
        if (errorMsg.includes('User rejected the request')) {
             errorMsg = 'Transaction rejetée par l\'utilisateur.';
        } else if (errorMsg.includes('revert')) {
             errorMsg = 'La transaction a échoué (revert). La preuve a peut-être expiré ou est invalide.';
        }

      toast({
        title: 'Order failed',
        description: errorMsg,
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
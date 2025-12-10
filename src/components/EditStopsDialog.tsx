"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, RefreshCw, ChevronUp, ChevronDown } from "lucide-react"; 

// --- Constantes ---
const PRICE_FACTOR = 1000000; 

// ====================================================================
// COMPOSANT : StepController (Logique de contrainte intégrée)
// ====================================================================
interface StepControllerProps {
    value: string;
    onChange: (value: string) => void;
    step: number; 
    decimals: number; 
    disabled?: boolean;
    hasError?: boolean;
    // 💡 NOUVELLES PROPS POUR LA LOGIQUE DE PRIX
    type: 'sl' | 'tp';
    isLong: boolean;
    entryPrice: number; // Float
    liqPrice: number;   // Float
}

const StepController: React.FC<StepControllerProps> = ({ 
    value, 
    onChange, 
    step, 
    decimals, 
    disabled = false, 
    hasError = false, 
    type, 
    isLong, 
    entryPrice, 
    liqPrice 
}) => {
    
    // Convertit la valeur actuelle pour la manipulation numérique
    let numericValue = parseFloat(value);
    if (!Number.isFinite(numericValue)) {
        // Si la valeur est vide ou invalide, on part de 0 pour l'incrémentation
        numericValue = 0; 
    }
    
    // Fonction d'arrondi correct pour éviter les erreurs de virgule flottante
    const roundValue = (val: number) => {
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
    };


    const handleStep = (delta: number) => {
        
        let newValue = roundValue(numericValue + delta);

        // ----------------------------------------
        // 💡 LOGIQUE DE CONTRÔLE DES PRIX
        // ----------------------------------------
        
        // --- 1. CONTRÔLE DU STOP LOSS (SL) ---
        if (type === 'sl') {
            // SL: Ne peut pas dépasser le prix d'entrée (direction de la perte)
            if (isLong) {
                // LONG: SL doit être < Entry (mais > Liq)
                // Si l'incrémentation dépasse Entry, on la fixe à Entry
                newValue = Math.min(newValue, entryPrice);
            } else {
                // SHORT: SL doit être > Entry (mais < Liq)
                // Si l'incrémentation dépasse Entry, on la fixe à Entry
                newValue = Math.max(newValue, entryPrice);
            }
            
            // SL: Ne peut pas devenir moins sécuritaire que le prix de liquidation (limite absolue)
            if (isLong) {
                // LONG: Ne peut pas être <= Liq
                newValue = Math.max(newValue, liqPrice + step); // Doit être supérieur à Liq d'au moins 1 step
            } else {
                // SHORT: Ne peut pas être >= Liq
                newValue = Math.min(newValue, liqPrice - step); // Doit être inférieur à Liq d'au moins 1 step
            }
        }
        
        // --- 2. CONTRÔLE DU TAKE PROFIT (TP) ---
        if (type === 'tp') {
            // TP: Doit être dans la zone de gain (dépasser Entry)
            if (isLong) {
                // LONG: TP doit être > Entry
                newValue = Math.max(newValue, entryPrice + step); // Doit être supérieur à Entry d'au moins 1 step
            } else {
                // SHORT: TP doit être < Entry
                newValue = Math.min(newValue, entryPrice - step); // Doit être inférieur à Entry d'au moins 1 step
            }
        }

        // ----------------------------------------

        // S'assurer que la valeur n'est pas négative
        newValue = Math.max(newValue, 0); 
        
        // Si la nouvelle valeur est très proche de zéro et qu'elle a été initialement vide, 
        // on pourrait vouloir la garder comme '0.00' ou vide, mais ici on la met à '0.00'
        onChange(newValue.toFixed(decimals));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; 
        onChange(val); 
    };
    
    // Affichage: Utiliser '0.00' si la valeur est vide/invalide pour l'input, sinon la valeur state
    const displayValue = (value === '' || !Number.isFinite(numericValue)) ? '0.00' : value;

    return (
        <div className="relative flex items-center">
            <Input
              type="text" 
              value={displayValue} // Utilisation de displayValue
              onChange={handleInputChange}
              placeholder="0.00"
              disabled={disabled}
              className={`h-12 text-lg pr-12 text-center focus:border-blue-500 transition-colors ${hasError ? 'border-red-500 ring-red-500' : 'border-gray-300'}`}
            />
            
            <div className="absolute right-0 top-0 h-full flex flex-col justify-center border-l border-gray-300">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-10 p-0 border-b border-gray-300/80 rounded-none rounded-tr-lg hover:bg-gray-100"
                    onClick={() => handleStep(step)}
                    disabled={disabled}
                >
                    <ChevronUp className="w-4 h-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-10 p-0 rounded-none rounded-br-lg hover:bg-gray-100"
                    onClick={() => handleStep(-step)}
                    disabled={disabled}
                >
                    <ChevronDown className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
// ====================================================================


interface UpdateStopsPayload {
    id: number;
    slPrice: string | null; 
    tpPrice: string | null; 
    isSLChanged: boolean;
    isTPChanged: boolean;
}

interface EditStopsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: number;
  currentSL: number; 
  currentTP: number; 
  entryPrice: number; 
  liqPrice: number; 
  isLong: boolean; 
  priceStep: number; 
  priceDecimals: number; 
  onConfirm: (payload: UpdateStopsPayload) => void;
  disabled: boolean;
}

export const EditStopsDialog = ({
  open,
  onOpenChange,
  positionId,
  currentSL,
  currentTP,
  entryPrice,
  liqPrice,
  isLong,
  priceStep,
  priceDecimals,
  onConfirm,
  disabled,
}: EditStopsDialogProps) => {
  
  const safeEntryX6 = Number(entryPrice) || 0;
  const safeLiqX6 = Number(liqPrice) || 0;
  const safeCurrentSL = Number(currentSL) || 0;
  const safeCurrentTP = Number(currentTP) || 0;
  
  const formatValue = useCallback((valueX6: number, fixedDecimals = priceDecimals) => {
    if (valueX6 === 0) return '0.00'; // 💡 CHANGÉ: Affiche '0.00' si None/0
    const floatValue = valueX6 / PRICE_FACTOR;
    const formatted = floatValue.toFixed(fixedDecimals);
    
    return parseFloat(formatted).toString(); 
  }, [priceDecimals]);
  
  // Conversions des prix de référence en Float pour la logique de StepController
  const entryPriceFloat = safeEntryX6 / PRICE_FACTOR;
  const liqPriceFloat = safeLiqX6 / PRICE_FACTOR;

  // States locaux initialisés avec les valeurs actuelles formatées
  const [slPrice, setSlPrice] = useState(formatValue(safeCurrentSL));
  const [tpPrice, setTpPrice] = useState(formatValue(safeCurrentTP));
  
  // Valeurs initiales au format string (pour la comparaison)
  // On utilise '0.00' si l'original était 0, pour refléter l'affichage de l'input
  const initialSLPrice = useMemo(() => formatValue(safeCurrentSL), [safeCurrentSL, formatValue]);
  const initialTPPrice = useMemo(() => formatValue(safeCurrentTP), [safeCurrentTP, formatValue]);

  // Réinitialiser les états locaux lorsque la modale s'ouvre
  useEffect(() => {
    if (open) {
      setSlPrice(formatValue(safeCurrentSL));
      setTpPrice(formatValue(safeCurrentTP));
    }
  }, [open, safeCurrentSL, safeCurrentTP, formatValue]);

  // Logique de Validation
  const validationError = useMemo(() => {
    const sl = parseFloat(slPrice);
    const tp = parseFloat(tpPrice);
    
    // Permet la réinitialisation si l'utilisateur vide le champ (i.e. slPrice === '0.00' si initial était 0.00)
    const isSLChanged = slPrice !== initialSLPrice;
    const isTPChanged = tpPrice !== initialTPPrice;

    if (!isSLChanged && !isTPChanged) {
        return { isSLInvalid: false, isTPInvalid: false, message: null }; 
    }
    
    // Déterminer si le champ est considéré comme "vide" ou "à 0"
    const isSLClear = slPrice === '0.00' || slPrice === '0' || slPrice === '';
    const isTPClear = tpPrice === '0.00' || tpPrice === '0' || tpPrice === '';
    
    let slMessage: string | null = null;
    let tpMessage: string | null = null;
    let isSLInvalid = false;
    let isTPInvalid = false;
    
    // Règle 1: SL doit être entre Entry et Liq. (dans le sens de la perte)
    if (!isSLClear) {
        if (!Number.isFinite(sl) || sl <= 0) {
            slMessage = `Stop Loss Price is invalid.`;
            isSLInvalid = true;
        }
        // SL doit être plus sécuritaire que le prix de liquidation
        else if ((isLong && sl <= liqPriceFloat) || (!isLong && sl >= liqPriceFloat)) {
             slMessage = `SL must be safer than Liq. Price (${liqPriceFloat.toFixed(priceDecimals)}).`;
             isSLInvalid = true;
        }
        // SL doit être dans la zone de perte (entre Entry et Liq)
        else if ((isLong && sl >= entryPriceFloat) || (!isLong && sl <= entryPriceFloat)) {
            slMessage = `SL must be in the loss zone (opposite to entry, Entry: ${entryPriceFloat.toFixed(priceDecimals)}).`;
            isSLInvalid = true;
        }
    }

    // Règle 2: TP doit être dans le sens du gain
    if (!isTPClear) {
        if (!Number.isFinite(tp) || tp <= 0) {
            tpMessage = `Take Profit Price is invalid.`;
            isTPInvalid = true;
        }
        else if ((isLong && tp <= entryPriceFloat) || (!isLong && tp >= entryPriceFloat)) {
            tpMessage = `TP must be in the profit zone (Entry: ${entryPriceFloat.toFixed(priceDecimals)}).`;
            isTPInvalid = true;
        }
    }
    
    // Si une des validations échoue, on retourne le message combiné
    if (isSLInvalid || isTPInvalid) {
        let fullMessage = '';
        if (slMessage) fullMessage += `SL Error: ${slMessage} `;
        if (tpMessage) fullMessage += `TP Error: ${tpMessage}`;
        return { isSLInvalid, isTPInvalid, message: fullMessage.trim() };
    }

    return { isSLInvalid: false, isTPInvalid: false, message: null };
  }, [slPrice, tpPrice, isLong, entryPriceFloat, liqPriceFloat, priceDecimals, initialSLPrice, initialTPPrice]);
  
  // Destructuration pour plus de clarté
  const { isSLInvalid, isTPInvalid, message: validationMessage } = validationError;

  const handleConfirm = () => {
    // Si la valeur est '0.00' ou vide, cela signifie null (suppression du SL/TP)
    const isSLClear = slPrice === '0.00' || slPrice === '0' || slPrice === '';
    const isTPClear = tpPrice === '0.00' || tpPrice === '0' || tpPrice === '';

    const isSLChanged = isSLClear ? initialSLPrice !== '0.00' : slPrice !== initialSLPrice;
    const isTPChanged = isTPClear ? initialTPPrice !== '0.00' : tpPrice !== initialTPPrice;

    if (validationMessage || (!isSLChanged && !isTPChanged)) {
        if (!isSLChanged && !isTPChanged) onOpenChange(false); 
        return; 
    }
    
    const finalSL = isSLClear ? null : slPrice;
    const finalTP = isTPClear ? null : tpPrice;

    onConfirm({
        id: positionId,
        slPrice: finalSL,
        tpPrice: finalTP,
        isSLChanged,
        isTPChanged,
    });
    onOpenChange(false);
  };
  
  // Fonction pour réinitialiser aux valeurs initiales
  const handleReset = () => {
    setSlPrice(initialSLPrice);
    setTpPrice(initialTPPrice);
  };
  
  // Formate les prix pour l'affichage (Entry/Liq/Current)
  const displayPrice = (priceX6: number) => {
    if (priceX6 === 0) return 'None';
    return `${formatValue(priceX6)}`;
  }
  
  // Détermine si un changement a été effectué
  const isChanged = slPrice !== initialSLPrice || tpPrice !== initialTPPrice;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        // 💡 CHANGEMENT: Hauteur et largeur ajustées pour être plus responsive
        className={`w-full max-w-lg p-0 shadow-xl rounded-lg bg-white`}
      >
        
        {/* 1. En-tête (Sans la croix de fermeture) */}
        <DialogHeader className="p-4 border-b border-gray-200 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold text-gray-800">
             Edit Stop Loss & Take Profit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6">
          
          {/* 2. Bloc d'informations sur la position (Amélioré) */}
          <div className="text-sm font-medium flex items-center gap-6 pb-2 border-b border-gray-200/80">
            <span className="text-gray-500 font-semibold">Position {positionId}</span>

            {/* Direction */}
            <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${isLong ? 'bg-blue-600' : 'bg-red-600'}`}>
                {isLong ? 'LONG' : 'SHORT'}
            </span>
            
            {/* Prix d'Entrée */}
            <div className="flex items-center text-gray-700">
                <span className="text-gray-500 mr-1">Entry Price:</span>
                <span className="font-bold">{displayPrice(safeEntryX6)}</span>
            </div>

            {/* Prix de Liquidation */}
            <div className="flex items-center text-gray-700">
                <span className="text-gray-500 mr-1">Liq. Price:</span>
                <span className="font-bold text-red-600">{displayPrice(safeLiqX6)}</span>
            </div>
          </div>

          {/* 3. Champs de saisie côte à côte (Disposition du design) */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Bloc Stop Loss */}
            <div 
                className={`p-4 border rounded-lg space-y-3 ${isSLInvalid ? 'border-red-500' : 'border-gray-300'}`}
            >
                <div className="flex justify-between items-center text-sm">
                    <Label htmlFor="sl" className="font-bold">Stop Loss (USD)</Label>
                    <span className="text-gray-500">Current: {displayPrice(safeCurrentSL)}</span>
                </div>
                
                <StepController
                    value={slPrice}
                    onChange={setSlPrice}
                    step={priceStep}
                    decimals={priceDecimals}
                    disabled={disabled}
                    hasError={isSLInvalid}
                    type='sl'
                    isLong={isLong}
                    entryPrice={entryPriceFloat}
                    liqPrice={liqPriceFloat}
                />
            </div>

            {/* Bloc Take Profit */}
            <div 
                className={`p-4 border rounded-lg space-y-3 ${isTPInvalid ? 'border-red-500' : 'border-gray-300'}`}
            >
               <div className="flex justify-between items-center text-sm">
                  <Label htmlFor="tp" className="font-bold">Take Profit (USD)</Label>
                  <span className="text-gray-500">Current: {displayPrice(safeCurrentTP)}</span>
              </div>
              
              <StepController
                value={tpPrice}
                onChange={setTpPrice}
                step={priceStep}
                decimals={priceDecimals}
                disabled={disabled}
                hasError={isTPInvalid}
                type='tp'
                isLong={isLong}
                entryPrice={entryPriceFloat}
                liqPrice={liqPriceFloat}
              />
            </div>
          </div>
          
          {/* 4. Message d'erreur de validation (Sous les champs) */}
          {validationMessage && (
              <div className="text-sm text-white bg-red-600 p-3 rounded-md font-medium text-center">
                  {validationMessage}
              </div>
          )}

        </div>
        
        {/* 5. Boutons d'Action (Pied de page - Sur une seule ligne, sans séparation ni fond gris) */}
        <DialogFooter className="flex justify-between items-center p-6 pt-0 bg-white">
          
          <Button 
            variant="ghost" 
            onClick={handleReset} 
            disabled={!isChanged || disabled}
            title="Reset to current values" 
            className="text-gray-500 hover:bg-gray-100 px-3 py-2"
          >
             <RefreshCw className="w-4 h-4 mr-1" /> Reset to Current
          </Button>

          <Button 
            onClick={handleConfirm} 
            disabled={!!validationMessage || !isChanged || disabled}
            className={`font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center h-10 px-5`}
          >
            Confirm Changes <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
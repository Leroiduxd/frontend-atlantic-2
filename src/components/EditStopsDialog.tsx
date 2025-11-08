"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, RefreshCw, ChevronUp, ChevronDown, X } from "lucide-react"; 

// ====================================================================
// COMPOSANT : StepController (Ajusté)
// ====================================================================
interface StepControllerProps {
    value: string;
    onChange: (value: string) => void;
    step: number; // Taille du tick (ex: 0.01)
    decimals: number; // Nombre de décimales
    disabled?: boolean;
}

const StepController: React.FC<StepControllerProps> = ({ value, onChange, step, decimals, disabled = false }) => {
    const numericValue = parseFloat(value) || 0;

    // Utiliser Number.isFinite(numericValue) pour s'assurer que le calcul est fait sur un nombre
    const handleStep = (delta: number) => {
        if (!Number.isFinite(numericValue)) return;
        const newValue = numericValue + delta;
        onChange(newValue.toFixed(decimals));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; 
        onChange(val); 
    };

    return (
        <div className="relative flex items-center">
            <Input
              type="text" // Changé à text pour permettre la saisie de '.' ou de nombres incomplets sans trigger le formatage de type number
              value={value}
              onChange={handleInputChange}
              placeholder="0.00"
              disabled={disabled}
              className="h-10 text-base pr-10"
            />
            
            <div className="absolute right-0 top-0 h-full flex flex-col justify-center border-l border-gray-300">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-8 p-0 border-b border-gray-300/80 rounded-none rounded-tr-md"
                    onClick={() => handleStep(step)}
                    disabled={disabled}
                >
                    <ChevronUp className="w-4 h-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-8 p-0 rounded-none rounded-br-md"
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

// Définition de l'interface pour la fonction onConfirm mise à jour
interface UpdateStopsPayload {
    id: number;
    slPrice: string | null; // null si pas modifié
    tpPrice: string | null; // null si pas modifié
    isSLChanged: boolean;
    isTPChanged: boolean;
}

interface EditStopsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: number;
  currentSL: number; // Prix SL actuel (x6)
  currentTP: number; // Prix TP actuel (x6)
  entryPrice: number; // Prix d'entrée (x6)
  liqPrice: number; // Prix de liquidation (x6)
  isLong: boolean; // Direction de la position
  priceStep: number; // Le ticksize (ex: 0.01)
  priceDecimals: number; // Nombre de décimales
  // Signature de onConfirm mise à jour pour la nouvelle logique
  onConfirm: (payload: UpdateStopsPayload) => void;
}

const PRICE_FACTOR = 1000000; 

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
}: EditStopsDialogProps) => {
  
  // Sécurisation des valeurs x6
  const safeEntryX6 = Number(entryPrice) || 0;
  const safeLiqX6 = Number(liqPrice) || 0;
  const safeCurrentSL = Number(currentSL) || 0;
  const safeCurrentTP = Number(currentTP) || 0;
  
  // Fonction pour formater les valeurs X6 en string (affichage/édition)
  // Retire les zéros non significatifs, sauf si la valeur est 0 ou si elle est en cours de saisie
  const formatValue = useCallback((valueX6: number, fixedDecimals = priceDecimals) => {
    if (valueX6 === 0) return ''; // Permet de laisser le champ vide si SL/TP n'est pas défini
    const floatValue = valueX6 / PRICE_FACTOR;
    const formatted = floatValue.toFixed(fixedDecimals);
    
    // Retirer les zéros non significatifs après la virgule, mais garder la décimale si elle est seule.
    return parseFloat(formatted).toString(); 
  }, [priceDecimals]);
  
  // Conversions des prix de référence en Float (Utiliser les versions sécurisées)
  const entryPriceFloat = safeEntryX6 / PRICE_FACTOR;
  const liqPriceFloat = safeLiqX6 / PRICE_FACTOR;

  // States locaux initialisés avec les valeurs actuelles formatées
  const [slPrice, setSlPrice] = useState(formatValue(safeCurrentSL));
  const [tpPrice, setTpPrice] = useState(formatValue(safeCurrentTP));
  
  // Valeurs initiales au format string (pour la comparaison)
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
    
    // Si rien n'est saisi ET rien n'a été modifié
    if (slPrice === initialSLPrice && tpPrice === initialTPPrice) {
        return null; // Pas de changement
    }
    
    const isSLDefined = slPrice !== '';
    const isTPDefined = tpPrice !== '';
    
    // Règle 1: SL doit être entre Entry et Liq. (dans le sens de la perte)
    if (isSLDefined) {
        if (!Number.isFinite(sl) || sl <= 0) return `Stop Loss Price is invalid.`;
        
        // SL doit être plus sécuritaire que le prix de liquidation
        if ((isLong && sl <= liqPriceFloat) || (!isLong && sl >= liqPriceFloat)) {
             return `SL must be safer than Liq. Price (${liqPriceFloat.toFixed(priceDecimals)}).`;
        }
        // SL doit être dans la zone de perte (entre Entry et Liq)
        if ((isLong && sl >= entryPriceFloat) || (!isLong && sl <= entryPriceFloat)) {
            return `SL must be in the loss zone (opposite to entry).`;
        }
    }

    // Règle 2: TP doit être dans le sens du gain
    if (isTPDefined) {
        if (!Number.isFinite(tp) || tp <= 0) return `Take Profit Price is invalid.`;
        
        if ((isLong && tp <= entryPriceFloat) || (!isLong && tp >= entryPriceFloat)) {
            return `TP must be in the profit zone (Entry: ${entryPriceFloat.toFixed(priceDecimals)}).`;
        }
    }

    return null;
  }, [slPrice, tpPrice, isLong, entryPriceFloat, liqPriceFloat, priceDecimals, initialSLPrice, initialTPPrice]);


  const handleConfirm = () => {
    const isSLChanged = slPrice !== initialSLPrice;
    const isTPChanged = tpPrice !== initialTPPrice;

    if (validationError || (!isSLChanged && !isTPChanged)) {
        // Bloquer la confirmation si erreur ou si aucune modification
        if (!isSLChanged && !isTPChanged) onOpenChange(false); 
        return; 
    }
    
    // Déterminer la valeur finale à envoyer (utiliser null si pas de changement)
    const finalSL = isSLChanged ? slPrice : null;
    const finalTP = isTPChanged ? tpPrice : null;

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
    if (priceX6 === 0) return '-';
    // Utilise la fonction de formatage pour retirer les zéros inutiles
    return `$${formatValue(priceX6)}`;
  }
  
  // Détermine si un changement a été effectué
  const isChanged = slPrice !== initialSLPrice || tpPrice !== initialTPPrice;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[500px] max-w-none p-0 shadow-xl rounded-lg bg-white`}>
        
        {/* En-tête simplifié */}
        <DialogHeader className="p-4 border-b border-gray-200 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold text-gray-800">
             Edit Stop Loss & Take Profit
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="hover:bg-gray-100 p-2">
             <X className="w-5 h-5 text-gray-700" />
          </Button>
        </DialogHeader>

        <div className="space-y-6 p-6">
          
          {/* Bloc d'informations sur la position (Amélioré) */}
          <div className="text-sm font-medium p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            <div className="flex justify-between items-center pb-1 border-b border-gray-200/50">
                 <span className="text-gray-500">Position ID:</span>
                 <span className="font-bold text-gray-800">{positionId}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">Direction:</span>
                <span className={`font-bold ${isLong ? 'text-blue-600' : 'text-red-600'}`}>{isLong ? 'LONG' : 'SHORT'}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">Entry Price:</span>
                <span className="font-bold text-gray-800">{displayPrice(safeEntryX6)}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">Liq. Price:</span>
                <span className="font-bold text-red-500">{displayPrice(safeLiqX6)}</span>
            </div>
          </div>

          {/* Message d'erreur de validation */}
          {validationError && (
              <div className="text-sm text-white bg-red-600 p-3 rounded-md font-medium">
                  {validationError}
              </div>
          )}

          {/* Champs de saisie avec StepController */}
          <div className="space-y-4">
            
            {/* Stop Loss */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <Label htmlFor="sl" className="text-base font-medium">Stop Loss (USD)</Label>
                  <span className="text-xs text-gray-500">Current: {displayPrice(safeCurrentSL)}</span>
              </div>
              <StepController
                value={slPrice}
                onChange={setSlPrice}
                step={priceStep}
                decimals={priceDecimals}
              />
            </div>

            {/* Take Profit */}
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                  <Label htmlFor="tp" className="text-base font-medium">Take Profit (USD)</Label>
                  <span className="text-xs text-gray-500">Current: {displayPrice(safeCurrentTP)}</span>
              </div>
              <StepController
                value={tpPrice}
                onChange={setTpPrice}
                step={priceStep}
                decimals={priceDecimals}
              />
            </div>
          </div>
        </div>
        
        {/* Boutons d'Action (Bas) */}
        <DialogFooter className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          
          <Button variant="ghost" onClick={handleReset} disabled={!isChanged} title="Reset to current values" className="text-gray-500 hover:text-gray-800">
             <RefreshCw className="w-4 h-4 mr-1" /> Reset
          </Button>

          <Button 
            onClick={handleConfirm} 
            disabled={!!validationError || !isChanged} 
            className={`font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center`}
          >
            Confirm Changes <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
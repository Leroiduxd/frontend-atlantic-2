"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ChevronUp, ChevronDown, X } from "lucide-react"; 
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";

const PRICE_FACTOR = 1000000; 

const StepController = ({ value, onChange, step, decimals, disabled, hasError, type, isLong, entryPrice, liqPrice }: any) => {
    let numericValue = parseFloat(value) || 0;
    const handleStep = (delta: number) => {
        const factor = Math.pow(10, decimals);
        let newValue = Math.round((numericValue + delta) * factor) / factor;
        
        if (type === 'sl') {
            if (isLong) {
                newValue = Math.min(newValue, entryPrice);
                newValue = Math.max(newValue, liqPrice + step);
            } else {
                newValue = Math.max(newValue, entryPrice);
                newValue = Math.min(newValue, liqPrice - step);
            }
        }
        if (type === 'tp') {
            if (isLong) newValue = Math.max(newValue, entryPrice + step);
            else newValue = Math.min(newValue, entryPrice - step);
        }
        onChange(newValue.toFixed(decimals));
    };

    return (
        <div className="relative flex items-center">
            <Input
              type="text" 
              value={value === '' ? '0.00' : value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              // Dark Mode: Fond noir, texte blanc, bordure sombre
              className={`h-10 text-sm pr-10 text-center rounded-none focus-visible:ring-0 transition-colors
                bg-white border-gray-300 focus:border-black
                dark:bg-black dark:border-zinc-800 dark:text-white dark:focus:border-zinc-600
                ${hasError ? 'border-red-500' : ''}`}
            />
            <div className="absolute right-0 top-0 h-full flex flex-col justify-center border-l border-gray-300 dark:border-zinc-800">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-8 p-0 border-b border-gray-200 dark:border-zinc-800 rounded-none hover:bg-gray-50 dark:hover:bg-zinc-900 dark:text-zinc-400" 
                    onClick={() => handleStep(step)}
                >
                    <ChevronUp className="w-3 h-3" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-1/2 w-8 p-0 rounded-none hover:bg-gray-50 dark:hover:bg-zinc-900 dark:text-zinc-400" 
                    onClick={() => handleStep(-step)}
                >
                    <ChevronDown className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
};

export const EditStopsDialog = ({ open, onOpenChange, positionId, priceStep, priceDecimals, onConfirm, disabled }: any) => {
  const [positionData, setPositionData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [slPrice, setSlPrice] = useState("0.00");
  const [tpPrice, setTpPrice] = useState("0.00");

  useEffect(() => {
    if (open && positionId) {
      setIsLoading(true);
      fetch(`https://api.brokex.trade/position/${positionId}`)
        .then(res => res.json())
        .then(pos => {
          setPositionData(pos);
          setSlPrice((pos.sl_x6 / PRICE_FACTOR).toFixed(priceDecimals));
          setTpPrice((pos.tp_x6 / PRICE_FACTOR).toFixed(priceDecimals));
          return fetch(`https://backend.brokex.trade/history?pair=${pos.asset_id}&interval=14400`);
        })
        .then(res => res.json())
        .then(history => {
            setHistoryData(history.map((d: any) => ({ ...d, close: parseFloat(d.close) })));
        })
        .finally(() => setIsLoading(false));
    }
  }, [open, positionId, priceDecimals]);

  const entryPrice = positionData ? positionData.entry_x6 / PRICE_FACTOR : 0;
  const liqPrice = positionData ? positionData.liq_x6 / PRICE_FACTOR : 0;
  const isLong = positionData?.long_side ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[500px] p-0 overflow-hidden flex rounded-none shadow-none gap-0 
        bg-white border-gray-300 
        dark:bg-black dark:border-zinc-800">
        
        {/* --- GAUCHE : GRAPHIQUE --- */}
        {/* Fond Clair: #F5F5F5 | Fond Sombre: zinc-950 (presque noir mais distinguable) */}
        <div className="w-[60%] bg-[#F5F5F5] dark:bg-zinc-950 relative flex flex-col transition-colors duration-300">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {/* Grille : Grise claire en light, très sombre en dark */}
              <CartesianGrid strokeDasharray="0" stroke="var(--chart-grid)" vertical={true} className="stroke-[#E5E5E5] dark:stroke-zinc-800" />
              
              <XAxis 
                dataKey="timestamp" 
                tick={{fontSize: 9, fill: '#888'}} 
                tickFormatter={(str) => str.split(' ')[1].substring(0, 5)}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['auto', 'auto']} 
                orientation="right" 
                tick={{fontSize: 9, fill: '#888'}}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => val.toFixed(priceDecimals)}
              />
              <Tooltip 
                contentStyle={{ 
                    borderRadius: '0px', 
                    border: '1px solid #CCC', 
                    fontSize: '10px',
                    // On laisse le style inline par défaut pour le tooltip chart js, difficile à styliser via tailwind ici
                }}
              />
              <Area 
                type="monotone" 
                dataKey="close" 
                stroke="#2563eb" 
                strokeWidth={1.5} 
                fill="none" 
                animationDuration={0}
              />
              <ReferenceLine y={entryPrice} stroke="#2563eb" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* --- DROITE : INFOS ET CONTROLES --- */}
        {/* Fond: Blanc vs Noir | Bordure: Grise vs Zinc-800 */}
        <div className="w-[40%] p-8 flex flex-col border-l border-gray-200 dark:border-zinc-800 relative bg-white dark:bg-black transition-colors duration-300">
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex-1 space-y-8">
            {/* Header Right */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tighter text-black dark:text-white uppercase">Position #{positionId}</h2>
                    <div className={`px-2 py-0.5 text-[9px] font-bold uppercase border 
                        ${isLong 
                            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' 
                            : 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-500'} 
                        rounded-none`}>
                        {isLong ? 'Long' : 'Short'} {positionData?.leverage_x}x
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Risk Management</p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Stop Loss (USD)</Label>
                <StepController
                  value={slPrice}
                  onChange={setSlPrice}
                  step={priceStep}
                  decimals={priceDecimals}
                  type="sl"
                  isLong={isLong}
                  entryPrice={entryPrice}
                  liqPrice={liqPrice}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Take Profit (USD)</Label>
                <StepController
                  value={tpPrice}
                  onChange={setTpPrice}
                  step={priceStep}
                  decimals={priceDecimals}
                  type="tp"
                  isLong={isLong}
                  entryPrice={entryPrice}
                  liqPrice={liqPrice}
                />
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-none space-y-3">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                    <span className="text-gray-400 dark:text-zinc-500">Entry</span>
                    <span className="text-black dark:text-zinc-200 font-mono">${entryPrice.toFixed(priceDecimals)}</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                    <span className="text-gray-400 dark:text-zinc-500">Liquidation</span>
                    <span className="text-red-500 dark:text-red-400 font-mono">${liqPrice.toFixed(priceDecimals)}</span>
                </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-6 text-center">
            <Button 
              onClick={() => onConfirm({ id: positionId, slPrice, tpPrice, isSLChanged: true, isTPChanged: true })}
              disabled={isLoading || disabled}
              className="w-full h-12 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 rounded-none font-bold uppercase text-[11px] tracking-[0.15em] transition-none"
            >
              Update Position <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <button 
              onClick={() => onOpenChange(false)}
              className="text-[10px] text-gray-400 hover:text-black dark:text-zinc-500 dark:hover:text-white font-bold uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
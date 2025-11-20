// ChartToolbar.tsx (MODIFIÉ)
import React from 'react';
import { OrderBook } from './OrderBook'; 
import { MarketAnalysis } from './MarketAnalysis'; // 🛑 NOUVEL IMPORT

// 🛑 Interfaces de Props pour passer la paire
interface ChartToolbarProps {
  selectedPair: string | undefined;
}

/**
 * Composant de barre d'outils (Toolbar) à placer au-dessus des contrôles de base du graphique.
 * Il contient l'OrderBook (50%) et l'Analyse (50%).
 */
export const ChartToolbar = (props: ChartToolbarProps) => {
    const { selectedPair } = props;
    
  return (
    <div 
      className="absolute bottom-12 left-0 right-0 h-[220px] bg-chart-bg border-t border-b border-border p-0 z-10 flex justify-start items-center"
    >
      
      {/* 🛑 1ère Colonne (50%) : Order Book */}
      <div className="w-1/2 h-full"> 
         <OrderBook selectedPair={selectedPair} /> 
      </div>
      
      {/* 🛑 2ème Colonne (50%) : Analyse du Marché */}
      <div className="w-1/2 h-full border-l border-border">
          {/* 🛑 PASSAGE DE LA PAIRE À MARKETANALYSIS */}
          <MarketAnalysis selectedPair={selectedPair} />
      </div>

    </div>
  );
};
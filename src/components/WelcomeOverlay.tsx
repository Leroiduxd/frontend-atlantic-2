// WelcomeOverlay.tsx
import React, { useEffect } from 'react';

// --- 1. Définition des Types et des Données ---

type AssetType = 'Forex' | 'Tech' | 'Commodity' | 'Crypto';

interface Asset {
  id: number;
  symbol: string;
}

interface ParsedPart {
  char: string;
  isBlue: boolean;
}

interface ParsedAsset extends Asset {
  parts: ParsedPart[];
}

interface TickerRow {
  type: AssetType;
  parsedAssets: ParsedAsset[];
}

export interface WelcomeOverlayProps {
  onDismiss?: () => void;
}

const parseSymbol = (symbol: string): ParsedPart[] => {
  const parts: ParsedPart[] = [];
  const regex = /([A-Z0-9])([A-Z0-9]*)/g;
  const fullMatch = symbol.match(regex);

  if (fullMatch) {
    for (const part of fullMatch) {
      if (part.length === 0) continue;

      const firstChar = part[0];
      const rest = part.substring(1);

      parts.push({ char: firstChar, isBlue: true });

      if (rest.length > 0) {
        parts.push({ char: rest, isBlue: false });
      }
    }
  }

  if (parts.length === 0 && symbol.length > 0) {
    parts.push({ char: symbol[0], isBlue: true });
    if (symbol.length > 1) {
      parts.push({ char: symbol.substring(1), isBlue: false });
    }
  }

  return parts;
};

// Données brutes des actifs
const rawFinanceAssets: { type: AssetType; assets: Asset[] }[] = [
  {
    type: 'Forex',
    assets: [
      { id: 1, symbol: 'EURUSD' },
      { id: 2, symbol: 'GBPUSD' },
      { id: 3, symbol: 'USDJPY' },
      { id: 4, symbol: 'SP500' },
      { id: 5, symbol: 'NAS100' },
    ],
  },
  {
    type: 'Tech',
    assets: [
      { id: 6, symbol: 'AAPLUSD' },
      { id: 7, symbol: 'MSFTUSD' },
      { id: 8, symbol: 'NVDAUSD' },
      { id: 9, symbol: 'TSLAUSD' },
      { id: 10, symbol: 'AMZNUSD' },
    ],
  },
  {
    type: 'Commodity',
    assets: [
      { id: 11, symbol: 'XAUUSD' },
      { id: 12, symbol: 'XAGUSD' },
      { id: 13, symbol: 'BRENT' },
      { id: 14, symbol: 'WTIUSD' },
      { id: 15, symbol: 'NGAS' },
    ],
  },
  {
    type: 'Crypto',
    assets: [
      { id: 16, symbol: 'BTCUSD' },
      { id: 17, symbol: 'ETHUSD' },
      { id: 18, symbol: 'SOLUSD' },
      { id: 19, symbol: 'XRPUSD' },
      { id: 20, symbol: 'LINKUSD' },
    ],
  },
];

const tickerRows: TickerRow[] = rawFinanceAssets.map(row => ({
  ...row,
  parsedAssets: row.assets.map(asset => ({
    ...asset,
    parts: parseSymbol(asset.symbol),
  })),
}));

// --- 2. Styles inline ---

const styles = {
  wrapper: {
    width: '100%', 
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  contentWrapper: {
    width: 'calc(100vw - 60px)', 
    marginLeft: '60px', 
    height: '100vh',
    overflow: 'hidden', 
  },

  row: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap' as const,
  },

  asset: {
    display: 'inline-flex',
    alignItems: 'center',
    marginRight: '3vw',
    fontWeight: 500, 
    letterSpacing: '0.08em',
    fontSize: 'clamp(3rem, 12vw, 18rem)',
  },
};

// --- 3. CSS brut ---

const TickerStyles = `
  .doto-style {
    font-family: "Doto", sans-serif;
    font-optical-sizing: auto;
    font-weight: 500; 
    font-style: normal;
    font-variation-settings: "ROND" 0;
  }

  @keyframes scroll-left {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .ticker {
    display: inline-flex;
    align-items: center;
    animation: scroll-left 8s linear infinite; 
  }

  .row:nth-child(2) .ticker {
    animation-duration: 10s;
  }

  .row:nth-child(3) .ticker {
    animation-duration: 12s;
  }

  .row:nth-child(4) .ticker {
    animation-duration: 9s;
  }
`;

// --- 4. Composant AssetDisplay (MODIFIÉ) ---

const AssetDisplay: React.FC<ParsedAsset> = ({ symbol, parts }) => {
  return (
    <div style={styles.asset} aria-label={`Actif: ${symbol}`}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={
            part.isBlue 
              ? "text-blue-600 dark:text-white transition-colors duration-300" 
              : "text-gray-500 dark:text-zinc-500 transition-colors duration-300"
          }
        >
          {part.char}
        </span>
      ))}
    </div>
  );
};

const FinanceTicker: React.FC = () => {
  return (
    <div style={styles.wrapper}>
      {tickerRows.map(row => (
        <div key={row.type} style={styles.row} className="row">
          <div className="ticker">
            {[...row.parsedAssets, ...row.parsedAssets].map((asset, index) => (
              <AssetDisplay
                key={`${row.type}-${asset.id}-${index}`}
                symbol={asset.symbol}
                parts={asset.parts}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- 5. Composant WelcomeOverlay ---

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onDismiss }) => {
  
  useEffect(() => {
    if (!onDismiss) return;

    // 1. Fermeture via la touche Entrée
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault(); 
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 2. Fermeture automatique après 3 secondes (3000 millisecondes)
    const timeoutId = setTimeout(() => {
      onDismiss();
    }, 2200);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId); // On nettoie le timer si le composant est démonté avant les 3s (ex: l'utilisateur a appuyé sur Entrée)
    };
  }, [onDismiss]); 

  return (
    <>
      <style>{TickerStyles}</style>

      <div className="fixed inset-0 z-50 pointer-events-none"> {/* pointer-events-none pour ne pas bloquer les clics en dessous si besoin, sauf sur le bouton */}
        
        {/* Fond : Blanc en Light / Noir Total en Dark */}
        <div 
            style={styles.contentWrapper} 
            className="doto-style bg-white dark:bg-black transition-colors duration-300 pointer-events-auto"
        >
          <FinanceTicker />
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute bottom-6 right-6 px-8 py-3 rounded-full 
                       bg-black text-white 
                       dark:bg-white dark:text-black 
                       text-lg font-bold tracking-widest transition-all hover:opacity-80 pointer-events-auto"
          >
            Enter Brokex
          </button>
        )}
      </div>
    </>
  );
};

export default WelcomeOverlay;
// WelcomeOverlay.tsx
import React, { useEffect } from 'react';

// --- 1. Définition des Types et des Données (Inchangées) ---

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

// Données brutes des actifs (Inchangées)
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

// --- 2. Styles inline (Inchangés) ---

const styles = {
  wrapper: {
    width: '100%', 
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  
  contentWrapper: {
    backgroundColor: '#ffffff', 
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

  charBlue: {
    color: '#2563eb', // Bleu
  },

  charGrey: {
    color: '#6b7280', // Gris
  },
};

// --- 3. CSS brut pour l’animation et la police variable (Inchangé) ---

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

// --- 4. Petits composants internes (Inchangés) ---

const AssetDisplay: React.FC<ParsedAsset> = ({ symbol, parts }) => {
  return (
    <div style={styles.asset} aria-label={`Actif: ${symbol}`}>
      {parts.map((part, index) => (
        <span
          key={index}
          style={part.isBlue ? styles.charBlue : styles.charGrey}
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

// --- 5. Composant WelcomeOverlay (le composant principal) ---

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onDismiss }) => {
  
  // NOUVELLE LOGIQUE : Gérer l'appui sur la touche Entrée
  useEffect(() => {
    if (!onDismiss) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Vérifie si la touche appuyée est "Enter" ou "Return"
      if (event.key === 'Enter') {
        // Empêche l'action par défaut du navigateur (souvent l'envoi de formulaire)
        event.preventDefault(); 
        
        // Simule le clic sur le bouton
        onDismiss();
      }
    };

    // Ajoute l'écouteur d'événement au document
    document.addEventListener('keydown', handleKeyDown);

    // Nettoie l'écouteur lors du démontage du composant
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]); // Dépend de onDismiss pour se reconfigurer si la fonction change (peu probable ici)

  return (
    <>
      <style>{TickerStyles}</style>

      {/* L'overlay principal */}
      <div className="fixed inset-0 z-50">
        
        {/* Conteneur pour le Ticker */}
        <div style={styles.contentWrapper} className="doto-style">
          <FinanceTicker />
        </div>

        {/* Bouton pour fermer l'overlay */}
        {onDismiss && (
          <button
            // J'ajoute un `autoFocus` pour que le bouton soit sélectionné par défaut
            // et que la touche `Enter` fonctionne nativement s'il est focus.
            // Cependant, l'écouteur `document.addEventListener('keydown')` est plus fiable
            // pour garantir que l'Enter fonctionne sans qu'un focus soit nécessaire.
            onClick={onDismiss}
            className="absolute bottom-6 right-6 px-8 py-3 rounded-full bg-black text-white text-lg font-bold tracking-widest transition-opacity hover:opacity-80"
          >
            Enter Brokex
          </button>
        )}
      </div>
    </>
  );
};

export default WelcomeOverlay;
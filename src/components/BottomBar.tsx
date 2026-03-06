"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket"; 
import { FaTelegram } from "react-icons/fa";
// ⚠️ MODIFIE LE CHEMIN CI-DESSOUS SELON OÙ TU AS ENREGISTRÉ AssetIcon
import { AssetIcon } from "@/hooks/useAssetIcon"; 

// --- Constantes de Hauteur ---
const FOOTER_HEIGHT = 34; 

// --- Types d'Actifs ---
interface Asset {
    id: number;
    name: string;
    symbol: string;
    pair: string;
}

interface AssetTickerData {
    id: number;
    symbol: string;
    currentPrice: string;
    change24h: string;
    isPositive: boolean;
    name: string;
    pair: string;
}

export interface BottomBarProps {
    onAssetSelect: (asset: Asset) => void; 
    currentAssetId: number; 
}

// --- Composant Séparateur Vertical ---
const TickerSeparator: React.FC = () => (
    <div className="flex items-center h-full">
        <div 
            // CLAIR: Gris clair | SOMBRE: Gris très foncé (presque invisible sur le noir)
            className="bg-gray-200 dark:bg-zinc-800 flex-shrink-0" 
            style={{ width: '1px', height: '80%' }} 
        />
    </div>
);

// --- Icônes SVG ---
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const DocsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

// --- Composant TickerItem ---
interface TickerItemProps {
    data: AssetTickerData;
    onClick: (asset: Asset) => void; 
    isDark: boolean; // Ajouté pour gérer la couleur de l'icône
}

const TickerItem: React.FC<TickerItemProps> = ({ data, onClick, isDark }) => {
    const formatPrice = (priceStr: string) => {
        const price = parseFloat(priceStr);
        if (isNaN(price)) return '---';
        return price > 100 ? price.toFixed(2) : price.toFixed(4);
    };

    const price = formatPrice(data.currentPrice);
    const change = parseFloat(data.change24h).toFixed(2);
    const changeText = data.isPositive ? `+${change}%` : `${change}%`;
    
    // GESTION COULEURS :
    // Mode Clair : Positif = Bleu / Négatif = Rouge
    // Mode Sombre : Positif = Blanc / Négatif = Rouge (plus clair)
    const changeColor = data.isPositive 
        ? 'text-blue-600 dark:text-white' 
        : 'text-red-600 dark:text-red-500';
    
    const handleClick = () => {
        onClick({
            id: data.id,
            name: data.name,
            symbol: data.symbol,
            pair: data.pair,
        });
    };

    // Hover : Gris clair en mode light, Blanc transparent en mode dark
    const baseClasses = "flex items-center flex-shrink-0 text-[13px] font-mono transition cursor-pointer h-full hover:bg-gray-50 dark:hover:bg-white/10 rounded";

    return (
        <div 
            className={baseClasses}
            onClick={handleClick}
            style={{ paddingLeft: '1rem', paddingRight: '1rem' }} 
        >
            {/* L'icône importée s'affiche ici */}
            <AssetIcon 
                assetId={data.id} 
                isDark={isDark} 
                size="14px" 
                className="mr-2 opacity-70 dark:opacity-80" 
            />
            <span className="font-bold mr-2 text-gray-600 dark:text-zinc-500">{data.symbol}</span>
            <span className="font-semibold mr-3 text-black dark:text-zinc-300">{price}</span>
            <span className={`font-medium ${changeColor}`}>{changeText}</span>
        </div>
    );
};

// --- CSS pour l'Animation ---
const MarqueeStyles = `
    @keyframes scroll-left-slow {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
    }
    .marquee-container {
        display: flex;
        width: fit-content;
        animation: scroll-left-slow 180s linear infinite; 
    }
    .marquee-container:hover {
        animation-play-state: paused;
    }
`;

// --- Composant Principal BottomBar ---
export const BottomBar: React.FC<BottomBarProps> = ({ onAssetSelect, currentAssetId }) => {
    const { data: wsData, connected } = useWebSocket();
    const [isDark, setIsDark] = useState(false);

    // Détection du thème (pour adapter les logos)
    useEffect(() => {
        const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
        checkTheme(); // Check initial
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    
    const allAssetsData: AssetTickerData[] = useMemo(() => {
        if (!wsData || !connected) return [];
        const categorizedAssets = getAssetsByCategory(wsData);
        const allAssets = Object.values(categorizedAssets).flat();
        return allAssets
            .filter(asset => asset.currentPrice !== '0')
            .map(asset => ({
                id: asset.id,
                symbol: asset.symbol,
                currentPrice: asset.currentPrice,
                change24h: asset.change24h,
                isPositive: parseFloat(asset.change24h) >= 0,
                name: asset.name, 
                pair: asset.pair, 
            }));
    }, [wsData, connected]);

    const tickerItems = useMemo(() => {
        if (allAssetsData.length === 0) return [];
        let duplicatedItems = [...allAssetsData];
        for (let i = 0; i < 5; i++) {
            duplicatedItems = duplicatedItems.concat(allAssetsData.map(item => ({ ...item, key: `${item.id}-${i}` })));
        }
        return duplicatedItems;
    }, [allAssetsData]);

    // Loading State
    if (!connected || allAssetsData.length === 0) {
        return (
            <div 
                className="w-full bg-white dark:bg-black border-t border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 text-sm flex-shrink-0"
                style={{ height: `${FOOTER_HEIGHT}px` }} 
            >
                {connected ? "Loading market data..." : "Connecting to market data..."}
            </div>
        );
    }

    // Icônes : Gris clair -> Noir au survol (Light) / Gris -> Blanc au survol (Dark)
    const iconLinkClass = "text-gray-400 hover:text-black dark:text-zinc-500 dark:hover:text-white transition-colors flex items-center justify-center";

    return (
        <div 
            // FOND : bg-white (clair) -> bg-black (sombre total)
            // BORDURE : border-gray-200 (clair) -> border-white/10 (sombre subtil)
            className="w-full bg-white dark:bg-black border-t border-gray-200 dark:border-white/10 flex-shrink-0 overflow-hidden relative"
            style={{ height: `${FOOTER_HEIGHT}px` }} 
        >
            <style>{MarqueeStyles}</style>

            {/* Conteneur Marquee */}
            <div className="marquee-container h-full items-center">
                {tickerItems.flatMap((data, index) => {
                    const elements = [
                        <TickerItem key={`item-${data.id}-${index}`} data={data} onClick={onAssetSelect} isDark={isDark} />
                    ];
                    if (index < tickerItems.length - 1) {
                        elements.push(<TickerSeparator key={`sep-${data.id}-${index}`} />);
                    }
                    return elements;
                })}
            </div>

            {/* --- Bloc Fixe "Overlay" à Droite --- */}
            {/* FOND: bg-white (Clair) -> bg-black (Sombre)
                SHADOW: Ombre blanche pour fondre en clair -> Ombre noire pour fondre en sombre
            */}
            <div className="absolute right-0 top-0 h-full flex items-center z-20 bg-white dark:bg-black pl-4 pr-3 border-l border-gray-100 dark:border-white/10 shadow-[-10px_0_10px_rgba(255,255,255,0.8)] dark:shadow-[-10px_0_15px_rgba(0,0,0,1)]">
                
                {/* Section Logos */}
                <div className="flex items-center gap-3 mr-3">
                    <a href="https://t.me/brokexfi" target="_blank" rel="noopener noreferrer" className={iconLinkClass} title="Telegram">
                        <FaTelegram size={16} />
                    </a>
                    <a href="https://x.com/brokexfi" target="_blank" rel="noopener noreferrer" className={iconLinkClass} title="X (Twitter)">
                        <XIcon />
                    </a>
                    <a href="https://docs.brokex.trade" target="_blank" rel="noopener noreferrer" className={iconLinkClass} title="Documentation">
                        <DocsIcon />
                    </a>
                </div>

                {/* Séparateur Vertical */}
                <div className="bg-gray-300 dark:bg-zinc-800 mx-2" style={{ width: '1px', height: '60%' }}></div>

                {/* Indicateur Fonctionnel */}
                <div className="flex items-center gap-2 ml-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        Operational
                    </span>
                </div>
            </div>
            
        </div>
    );
};

export default BottomBar;
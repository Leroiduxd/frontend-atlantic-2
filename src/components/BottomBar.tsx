// components/BottomBar.tsx
"use client";

import React, { useMemo } from 'react';
// Assurez-vous que le chemin est correct pour votre hook useWebSocket
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket"; 

// --- Constantes de Hauteur ---
const FOOTER_HEIGHT = 34; // Hauteur demandée en pixels

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

// Props du composant principal
export interface BottomBarProps {
    onAssetSelect: (asset: Asset) => void; 
    currentAssetId: number; 
}

// --- Composant Séparateur Vertical ---
const TickerSeparator: React.FC = () => (
    <div className="flex items-center h-full">
        {/* MODIFICATION 2 : Barre fine, centrée, qui ne touche pas les extrémités */}
        <div 
            className="bg-gray-200 flex-shrink-0" 
            style={{ width: '1px', height: '80%' }} // Hauteur de 80% et largeur de 1px
        />
    </div>
);


// --- Composant TickerItem ---

interface TickerItemProps {
    data: AssetTickerData;
    onClick: (asset: Asset) => void; 
}

const TickerItem: React.FC<TickerItemProps> = ({ data, onClick }) => {
    // Formatage du prix
    const formatPrice = (priceStr: string) => {
        const price = parseFloat(priceStr);
        if (isNaN(price)) return '---';
        return price > 100 ? price.toFixed(2) : price.toFixed(4);
    };

    // Préparation des valeurs et des couleurs
    const price = formatPrice(data.currentPrice);
    const change = parseFloat(data.change24h).toFixed(2);
    const changeText = data.isPositive ? `+${change}%` : `${change}%`;
    
    // Bleu pour Positif, Rouge pour Négatif
    const changeColor = data.isPositive ? 'text-blue-600' : 'text-red-600';
    
    // Fonction à appeler lors du clic
    const handleClick = () => {
        onClick({
            id: data.id,
            name: data.name,
            symbol: data.symbol,
            pair: data.pair,
        });
    };

    // Classes pour le style
    const baseClasses = "flex items-center flex-shrink-0 text-[13px] font-mono transition cursor-pointer h-full hover:bg-gray-50 rounded";

    return (
        <div 
            className={baseClasses}
            onClick={handleClick}
            // Espacement des côtés de l'actif
            style={{ paddingLeft: '1rem', paddingRight: '1rem' }} 
        >
            
            {/* Symbole (Nom de la paire) */}
            <span className="font-bold mr-2 text-gray-600">{data.symbol}</span>
            
            {/* Prix actuel */}
            <span className="font-semibold mr-3">{price}</span>
            
            {/* Changement 24h (%) avec la couleur appropriée */}
            <span className={`font-medium ${changeColor}`}>{changeText}</span>
        </div>
    );
};

// --- CSS pour l'Animation de Défilement (Marquee) ---

const MarqueeStyles = `
    @keyframes scroll-left-slow {
        0% {
            transform: translateX(0);
        }
        100% {
            transform: translateX(-50%);
        }
    }

    .marquee-container {
        display: flex;
        width: fit-content;
        /* MODIFICATION 1 : Vitesse encore plus lente (180s) */
        animation: scroll-left-slow 180s linear infinite; 
    }
    
    /* Arrêt au survol */
    .marquee-container:hover {
        animation-play-state: paused;
    }
`;

// --- Composant Principal BottomBar ---

export const BottomBar: React.FC<BottomBarProps> = ({ onAssetSelect, currentAssetId }) => {
    const { data: wsData, connected } = useWebSocket();
    
    // 1. Agréger et enrichir les données des actifs
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

    // 2. Dupliquer les données pour le défilement infini
    const tickerItems = useMemo(() => {
        if (allAssetsData.length === 0) return [];
        
        // Dupliquer suffisamment pour que le défilement soit continu (5x)
        let duplicatedItems = [...allAssetsData];
        for (let i = 0; i < 5; i++) {
            duplicatedItems = duplicatedItems.concat(allAssetsData.map(item => ({ ...item, key: `${item.id}-${i}` })));
        }
        return duplicatedItems;
    }, [allAssetsData]);

    if (!connected || allAssetsData.length === 0) {
        // Afficher un état de chargement/connexion si pas de données
        return (
            <div 
                className="w-full bg-white border-t border-gray-200 flex items-center justify-center text-gray-500 text-sm flex-shrink-0"
                style={{ height: `${FOOTER_HEIGHT}px` }} 
            >
                {connected ? "Loading market data..." : "Connecting to market data..."}
            </div>
        );
    }

    return (
        // Conteneur principal de la barre
        <div 
            className="w-full bg-white border-t border-gray-200 flex-shrink-0 overflow-hidden relative"
            style={{ height: `${FOOTER_HEIGHT}px` }} 
        >
            {/* Style pour l'animation de défilement */}
            <style>{MarqueeStyles}</style>

            {/* Conteneur Marquee - Défilement effectif */}
            <div className="marquee-container h-full items-center">
                {tickerItems.flatMap((data, index) => {
                    const elements = [
                        <TickerItem 
                            key={`item-${data.id}-${index}`} 
                            data={data}
                            onClick={onAssetSelect}
                        />
                    ];
                    
                    // Ajouter le séparateur après chaque élément, sauf le dernier de tout le flux continu
                    if (index < tickerItems.length - 1) {
                        elements.push(
                            <TickerSeparator key={`sep-${data.id}-${index}`} />
                        );
                    }
                    return elements;
                })}
            </div>
        </div>
    );
};

export default BottomBar;
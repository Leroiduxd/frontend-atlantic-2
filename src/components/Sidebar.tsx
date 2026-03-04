"use client";

import { TrendingUp, Wallet, Droplet, Sun, Moon, Vault, Compass, Trophy } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import React, { useEffect, useState } from 'react';
import { useTheme } from "next-themes"; 

interface SidebarProps {
  setIsFaucetOpen: (open: boolean) => void;
  // Ajout de 'leaderboard' dans les types autorisés
  currentView: 'trading' | 'vault' | 'scan' | 'leaderboard';       
  onNavigate: (view: 'trading' | 'vault' | 'scan' | 'leaderboard') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setIsFaucetOpen, currentView, onNavigate }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // --- STYLE DYNAMIQUE DES ICONES ---
  const getIconStyle = (viewName: string) => {
    const baseStyle = "p-2 rounded-xl transition-all duration-200 cursor-pointer";
    
    if (currentView === viewName) {
      return `${baseStyle} text-white bg-white/10 shadow-sm`; 
    }
    return `${baseStyle} text-slate-400 hover:text-white hover:bg-white/5`; 
  };

  const navIconStyle = "p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200";

  return (
    <aside className={`
      fixed left-0 top-0 z-20 w-[60px] h-screen flex-shrink-0 flex flex-col items-center py-4 shadow-2xl
      border-r
      bg-slate-900 border-slate-800
      dark:bg-black dark:border-zinc-800
      transition-colors duration-300
    `}>
      
      {/* --- Haut --- */}
      <div className="space-y-6 flex-grow flex flex-col items-center w-full">
        {/* Logo */}
        <a href="https://brokex.trade" target="_blank" className="p-1 hover:opacity-80 transition-opacity">
          <img src="/logo.svg" alt="Logo" className="w-10 h-10" />
        </a>
        
        {/* BOUTON TRADING */}
        <button 
          onClick={() => onNavigate('trading')} 
          className={getIconStyle('trading')}
          title="Trading"
        >
          <TrendingUp className="w-6 h-6" />
        </button>

        {/* BOUTON VAULT */}
        <button
          onClick={() => onNavigate('vault')}
          className={getIconStyle('vault')}
          title="Vault"
        >
          <Vault className="w-6 h-6" />
        </button>

        {/* BOUTON SCAN / EXPLORER */}
        <button
          onClick={() => onNavigate('scan')}
          className={getIconStyle('scan')}
          title="Explorer"
        >
          <Compass className="w-6 h-6" />
        </button>

        {/* BOUTON LEADERBOARD (NOUVEAU) */}
        <button
          onClick={() => onNavigate('leaderboard')}
          className={getIconStyle('leaderboard')}
          title="Leaderboard"
        >
          <Trophy className="w-6 h-6" />
        </button>
        
        {/* BOUTON FAUCET */}
        <button
          onClick={() => setIsFaucetOpen(true)}
          className={navIconStyle}
          title="Faucet"
        >
          <Droplet className="w-6 h-6" />
        </button>
      </div>

      {/* --- Bas (Theme + Wallet) --- */}
      <div className="flex flex-col items-center w-full space-y-4 px-2 pb-2">
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className={navIconStyle}
            title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        )}

        <div className="w-full flex justify-center">
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openConnectModal, mounted: connectMounted }) => {
              const ready = connectMounted;
              const connected = ready && account && chain;
              return (
                <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                  {!connected ? (
                    <button onClick={openConnectModal} className={navIconStyle}>
                      <Wallet className="w-6 h-6" />
                    </button>
                  ) : chain.unsupported ? (
                    <button className="p-2 rounded-xl text-white bg-red-500 hover:bg-red-600 transition-colors">
                      <Wallet className="w-6 h-6" />
                    </button>
                  ) : (
                    <button 
                      onClick={openAccountModal} 
                      className="p-2 rounded-xl text-white transition-colors 
                        bg-blue-600 hover:bg-blue-700 
                        dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <Wallet className="w-6 h-6" />
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
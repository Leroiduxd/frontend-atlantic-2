"use client";

import { TrendingUp, Wallet, Droplet, Sun, Moon, Vault, Compass, Trophy, PanelLeftClose, PanelLeftOpen, Briefcase } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import React, { useEffect, useState } from 'react';
import { useTheme } from "next-themes"; 

interface SidebarProps {
  setIsFaucetOpen: (open: boolean) => void;
  currentView: 'trading' | 'vault' | 'scan' | 'leaderboard' | 'portfolio';       
  onNavigate: (view: 'trading' | 'vault' | 'scan' | 'leaderboard' | 'portfolio') => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const Tooltip = ({ label, isExpanded }: { label: string, isExpanded: boolean }) => {
  if (isExpanded) return null;
  return (
    <span className="absolute left-[60px] bg-slate-800 dark:bg-zinc-800 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-50 border border-slate-700 dark:border-zinc-700 -translate-x-2 group-hover:translate-x-0">
      {label}
    </span>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ setIsFaucetOpen, currentView, onNavigate, isExpanded, setIsExpanded }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Nouvel état pour gérer l'apparition du texte en décalé (après l'animation)
  const [showText, setShowText] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Effet pour retarder l'affichage du texte à l'ouverture
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isExpanded) {
      timer = setTimeout(() => setShowText(true), 200); // Attend 200ms que la barre s'ouvre
    } else {
      setShowText(false); // Cache instantanément à la fermeture
    }
    return () => clearTimeout(timer);
  }, [isExpanded]);

  const handleNavigate = (view: 'trading' | 'vault' | 'scan' | 'leaderboard' | 'portfolio') => {
    if (view !== currentView) {
      onNavigate(view);
      setIsExpanded(false);
    }
  };

  const getIconStyle = (viewName: string) => {
    const baseStyle = `h-10 flex items-center rounded-xl transition-all duration-200 cursor-pointer relative group ${isExpanded ? 'w-full px-3 justify-start gap-3' : 'w-10 justify-center'}`;
    
    if (currentView === viewName) {
      return `${baseStyle} text-white bg-white/10 shadow-sm`; 
    }
    return `${baseStyle} text-slate-400 hover:text-white hover:bg-white/5`; 
  };

  const navIconStyle = `h-10 flex items-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 relative group cursor-pointer ${isExpanded ? 'w-full px-3 justify-start gap-3' : 'w-10 justify-center'}`;

  return (
    <aside className={`
      fixed left-0 top-0 z-20 h-screen flex-shrink-0 flex flex-col items-center py-4 shadow-2xl
      border-r bg-slate-900 border-slate-800 dark:bg-black dark:border-zinc-800
      transition-all duration-300 ease-in-out
      ${isExpanded ? 'w-[180px] px-3' : 'w-[60px] px-0'}
    `}>
      
      {/* --- En-tête (Logo + Toggle) --- */}
      <div className={`flex items-center mb-8 mt-2 h-10 w-full ${isExpanded ? 'justify-between px-1' : 'justify-center'}`}>
        {!isExpanded ? (
          <button 
            onClick={() => setIsExpanded(true)}
            className="relative flex items-center justify-center w-10 h-10 group"
          >
            <img src="/logo.svg" alt="Logo" className="w-8 h-8 absolute transition-opacity duration-200 group-hover:opacity-0" />
            <PanelLeftOpen className="w-6 h-6 text-white absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
        ) : (
          <>
            <a href="https://brokex.trade" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity overflow-hidden">
              <img src="/logo.svg" alt="Logo" className="w-8 h-8 flex-shrink-0" />
              {showText && (
                <div className="flex flex-col justify-center animate-in fade-in duration-300">
                  <span className="font-bold text-white text-sm tracking-wide leading-tight">Brokex</span>
                  <span className="text-[10px] text-zinc-400 font-medium leading-tight">Protocol (V1)</span>
                </div>
              )}
            </a>
            <button 
              onClick={() => setIsExpanded(false)} 
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0 ml-1"
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>
      
      {/* --- Navigation Principale --- */}
      <div className="space-y-2 flex-grow flex flex-col w-full items-center">
        <button onClick={() => handleNavigate('trading')} className={getIconStyle('trading')}>
          <TrendingUp className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Trading</span>}
          <Tooltip label="Trading" isExpanded={isExpanded} />
        </button>

        <button onClick={() => handleNavigate('vault')} className={getIconStyle('vault')}>
          <Vault className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Vault</span>}
          <Tooltip label="Vault" isExpanded={isExpanded} />
        </button>

        <button onClick={() => handleNavigate('scan')} className={getIconStyle('scan')}>
          <Compass className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Explorer</span>}
          <Tooltip label="Explorer" isExpanded={isExpanded} />
        </button>

        <button onClick={() => handleNavigate('leaderboard')} className={getIconStyle('leaderboard')}>
          <Trophy className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Leaderboard</span>}
          <Tooltip label="Leaderboard" isExpanded={isExpanded} />
        </button>

        {/* --- NOUVEAU BOUTON PORTFOLIO --- */}
        <button onClick={() => handleNavigate('portfolio')} className={getIconStyle('portfolio')}>
          <Briefcase className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Portfolio</span>}
          <Tooltip label="Portfolio" isExpanded={isExpanded} />
        </button>
        
        <button onClick={() => { setIsFaucetOpen(true); setIsExpanded(false); }} className={navIconStyle}>
          <Droplet className="w-[22px] h-[22px] flex-shrink-0" />
          {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Faucet</span>}
          <Tooltip label="Faucet" isExpanded={isExpanded} />
        </button>
      </div>

      {/* --- Bas (Theme + Wallet) --- */}
      <div className="flex flex-col w-full space-y-2 pb-2 mt-4 items-center">
        {mounted && (
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={navIconStyle}>
            {theme === 'dark' ? <Sun className="w-[22px] h-[22px] flex-shrink-0" /> : <Moon className="w-[22px] h-[22px] flex-shrink-0" />}
            {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Theme</span>}
            <Tooltip label="Theme" isExpanded={isExpanded} />
          </button>
        )}

        {/* Le wrapper est forcé d'être 100% ET de centrer son contenu quand il est petit */}
        <div className="w-full flex justify-center">
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openConnectModal, mounted: connectMounted }) => {
              const ready = connectMounted;
              const connected = ready && account && chain;
              
              return (
                // AJOUT : "w-full flex justify-center" ici garantit le bon alignement !
                <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })} className="w-full flex justify-center">
                  {!connected ? (
                    <button onClick={openConnectModal} className={navIconStyle}>
                      <Wallet className="w-[22px] h-[22px] flex-shrink-0" />
                      {showText && <span className="font-semibold text-sm animate-in fade-in duration-300">Connect</span>}
                      <Tooltip label="Connect Wallet" isExpanded={isExpanded} />
                    </button>
                  ) : chain.unsupported ? (
                    <button className={`h-10 flex items-center rounded-xl text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer relative group ${isExpanded ? 'w-full px-3 justify-start gap-3' : 'w-10 justify-center'}`}>
                      <Wallet className="w-[22px] h-[22px] flex-shrink-0" />
                      {showText && <span className="font-semibold text-sm truncate animate-in fade-in duration-300">Wrong Network</span>}
                      <Tooltip label="Wrong Network" isExpanded={isExpanded} />
                    </button>
                  ) : (
                    <button 
                      onClick={openAccountModal} 
                      className={`h-10 flex items-center rounded-xl text-white shadow-sm bg-slate-800 hover:bg-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer relative group ${isExpanded ? 'w-full px-3 justify-start gap-3' : 'w-10 justify-center'}`}
                    >
                      <Wallet className="w-[22px] h-[22px] flex-shrink-0" />
                      {showText && <span className="font-semibold text-sm truncate animate-in fade-in duration-300">{account.displayName}</span>}
                      <Tooltip label="Wallet" isExpanded={isExpanded} />
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
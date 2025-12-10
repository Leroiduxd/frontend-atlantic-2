"use client";

// Importations des icônes de lucide-react pour la navigation principale
import { TrendingUp, Wallet, Droplet, BookOpenText } from "lucide-react";

// Importations des icônes de MUI (Material-UI) pour les liens sociaux
import TelegramIcon from '@mui/icons-material/Telegram';
import XIcon from '@mui/icons-material/X';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import React from 'react';

// Définition des props que le composant attend
interface SidebarProps {
  // Fonction pour définir si la FaucetDialog doit être ouverte ou fermée
  setIsFaucetOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setIsFaucetOpen }) => {
  // Style commun pour les icônes de navigation
  const navIconStyle = "p-2 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-200";
  // Style pour l'icône de navigation active/primaire (Trading)
  const activeIconStyle = "p-2 rounded-xl text-sidebar-foreground bg-sidebar-accent transition-colors duration-200";

  // Style pour les icônes MUI qui n'ont pas la classe 'w-6 h-6' intégrée
  const muiIconSize = "w-5 h-5";
  const muiIconSize1 = "w-5 h-5";

  return (
    <aside className="fixed left-0 top-0 z-20 w-[60px] h-screen flex-shrink-0 bg-sidebar flex flex-col items-center py-4 shadow-2xl">
      {/* Top Icons */}
      <div className="space-y-6 flex-grow flex flex-col items-center w-full">
        
        {/* Logo */}
        <a 
          href="https://brokex.trade" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="p-1 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" 
          title="Accueil BrokeX"
        >
          <img 
            src="/logo.svg" 
            alt="Logo BrokeX" 
            className="w-10 h-10" 
          />
        </a>
        
        {/* Navigation Icons (Trading) */}
        <a 
          
          className={activeIconStyle} 
          title="Trading"
        >
          <TrendingUp className="w-6 h-6" />
        </a>
        
        {/* Bouton Faucet */}
        <button
          onClick={() => setIsFaucetOpen(true)}
          className={navIconStyle}
          title="Faucet"
        >
          <Droplet className="w-6 h-6" />
        </button>

      </div>

      {/* Bottom Actions - Social & Wallet Connection */}
      <div className="flex flex-col items-center w-full space-y-4 px-2 pb-2">
        
        {/* Icône Docs (Reste en lucide-react) */}
        <a 
          href="https://docs.brokex.trade" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={navIconStyle} 
          title="Documentation"
        >
          <BookOpenText className="w-6 h-6" />
        </a>

        {/* Icône Telegram (Utilise MUI - TelegramIcon) */}
        <a 
          href="https://t.me/brokexfi" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={navIconStyle} 
          title="Telegram"
        >
          <TelegramIcon className={muiIconSize1} />
        </a>
        
        {/* Icône X (Twitter) (Utilise MUI - XIcon) */}
        <a 
          href="https://x.com/brokexfi" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={navIconStyle} 
          title="X (Twitter)"
        >
          <XIcon className={muiIconSize} />
        </a>

        {/* Wallet Connection */}
        <div className="w-full flex justify-center">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              // Styles pour le bouton de connexion/déconnexion
              const walletButtonStyle = (bgColor: string, hoverColor: string) => 
                `p-2 rounded-xl text-white ${bgColor} ${hoverColor} transition-colors duration-200`;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          className="p-2 rounded-xl bg-transparent text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-200"
                          title="Connect Wallet"
                        >
                          <Wallet className="w-6 h-6" />
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button 
                          onClick={openChainModal}
                          className={walletButtonStyle("bg-trading-red", "hover:bg-trading-red/80")}
                          title="Wrong Network"
                        >
                          <Wallet className="w-6 h-6" />
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={openAccountModal}
                        className={walletButtonStyle("bg-sidebar-navy", "hover:bg-sidebar-navy/80")}
                        title="Connected"
                      >
                        <Wallet className="w-6 h-6" />
                      </button>
                    );
                  })()}
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
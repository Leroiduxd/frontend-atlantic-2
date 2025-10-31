"use client";

import { Menu, TrendingUp, BarChart3, Wallet, Droplet } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import React from 'react'; // Import de React

// Définition des props que le composant attend
interface SidebarProps {
  // Fonction pour définir si la FaucetDialog doit être ouverte ou fermée
  setIsFaucetOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setIsFaucetOpen }) => {
  return (
    <aside className="fixed left-0 top-0 z-20 w-[60px] h-screen flex-shrink-0 bg-sidebar flex flex-col items-center py-4 shadow-2xl">
      {/* Top Icons */}
      <div className="space-y-6 flex-grow flex flex-col items-center w-full">
        {/* Hamburger Menu Icon */}
        <div className="text-sidebar-foreground text-xl font-bold p-1 rounded-lg mt-0 cursor-pointer hover:bg-sidebar-accent transition-colors">
          <Menu className="w-8 h-8" />
        </div>
        
        {/* Navigation Icons */}
        <a 
          href="#trading" 
          className="p-2 rounded-xl text-sidebar-foreground bg-sidebar-accent transition-colors duration-200" 
          title="Trading"
        >
          <TrendingUp className="w-6 h-6" />
        </a>
        
        <a 
          href="#positions" 
          className="p-2 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-200" 
          title="Positions"
        >
          <BarChart3 className="w-6 h-6" />
        </a>

        {/* Bouton Faucet */}
        <button
          // Utilise la prop pour ouvrir le FaucetDialog dans le composant parent (Index.js)
          onClick={() => setIsFaucetOpen(true)}
          className="p-2 rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-200"
          title="Faucet"
        >
          <Droplet className="w-6 h-6" />
        </button>

      </div>

      {/* Bottom Actions - Wallet Connection */}
      <div className="flex flex-col items-center w-full space-y-4 px-2 pb-2">
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
                          className="p-2 rounded-xl bg-trading-red text-white hover:bg-trading-red/80 transition-colors duration-200"
                          title="Wrong Network"
                        >
                          <Wallet className="w-6 h-6" />
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={openAccountModal}
                        className="p-2 rounded-xl bg-sidebar-navy text-white hover:bg-sidebar-navy/80 transition-colors duration-200"
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
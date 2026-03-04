"use client";

import React, { useState } from 'react';
import Sidebar from "@/components/Sidebar";
import TradingSection from "@/components/TradingSection";
import VaultInterface from "@/components/vault"; 
import { FaucetDialog } from "@/components/FaucetDialog";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import MobileLayout from "@/components/mobile/MobileLayout"; 
import Leaderboard from "@/components/Leaderboard";
import Scan from "@/components/Scan"; // Vérifie bien la majuscule "Scan" pour éviter l'erreur de build

const Index: React.FC = () => {
  const [currentView, setCurrentView] = useState<'trading' | 'vault' | 'scan' | 'leaderboard'>('trading');
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <div className="antialiased bg-background dark:bg-black h-screen w-full transition-colors duration-300">

      {/* VERSION MOBILE */}
      <div className="md:hidden h-full w-full">
         <MobileLayout setIsFaucetOpen={setIsFaucetOpen} />
      </div>

      {/* VERSION DESKTOP */}
      <div className="hidden md:flex h-full overflow-hidden">
        
        {showWelcome && <WelcomeOverlay onDismiss={handleDismissWelcome} />}

        <Sidebar 
            setIsFaucetOpen={setIsFaucetOpen} 
            currentView={currentView}
            onNavigate={setCurrentView}
        />

        <main className="ml-[60px] w-[calc(100%-60px)] h-full bg-white dark:bg-black transition-colors duration-300">
            {/* NAVIGATION DES VUES DANS LE MAIN */}
            {currentView === 'trading' && (
              <div className="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth dark:bg-black">
                  <TradingSection />
              </div>
            )}
            
            {currentView === 'vault' && (
              <div className="h-full overflow-y-auto bg-slate-50 dark:bg-black transition-colors duration-300">
                  <VaultInterface />
              </div>
            )}

            {currentView === 'scan' && (
              <div className="h-full overflow-y-auto bg-slate-50 dark:bg-black transition-colors duration-300">
                  <Scan />
              </div>
            )}

            {/* AJOUT PROPRE DU LEADERBOARD ICI */}
            {currentView === 'leaderboard' && (
              <div className="h-full overflow-y-auto bg-slate-50 dark:bg-black transition-colors duration-300">
                  <Leaderboard />
              </div>
            )}
        </main>
      </div>

      {/* Faucet Dialog (Partagé Mobile & Desktop) */}
      <FaucetDialog
          open={isFaucetOpen}
          onOpenChange={setIsFaucetOpen}
      />

    </div>
  );
};

export default Index;
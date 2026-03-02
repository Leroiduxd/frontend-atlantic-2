"use client";

import React, { useState } from 'react';
import Sidebar from "@/components/Sidebar";
import TradingSection from "@/components/TradingSection";
import VaultInterface from "@/components/vault"; 
import { FaucetDialog } from "@/components/FaucetDialog";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import MobileLayout from "@/components/mobile/MobileLayout"; 

// 👇 1. IMPORT DU NOUVEAU COMPOSANT SCAN
import Scan from "@/components/Scan"; // Ajuste le chemin selon où tu as sauvegardé scan.tsx

const Index: React.FC = () => {
  // 👇 2. AJOUT DE 'scan' DANS LE STATE
  const [currentView, setCurrentView] = useState<'trading' | 'vault' | 'scan'>('trading');
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <div className="antialiased bg-background dark:bg-black h-screen w-full transition-colors duration-300">

      {/* =========================================================
          1. MOBILE VERSION (Visible if screen < 768px "md")
         ========================================================= */}
      <div className="md:hidden h-full w-full">
         <MobileLayout setIsFaucetOpen={setIsFaucetOpen} />
      </div>


      {/* =========================================================
          2. DESKTOP VERSION (Hidden on mobile "hidden md:flex")
         ========================================================= */}
      <div className="hidden md:flex h-full overflow-hidden">
        
        {/* Overlay (Desktop Only - Optionnel sur mobile ?) */}
        {showWelcome && <WelcomeOverlay onDismiss={handleDismissWelcome} />}

        <Sidebar 
            setIsFaucetOpen={setIsFaucetOpen} 
            currentView={currentView}
            onNavigate={setCurrentView}
        />

        <main className="ml-[60px] w-[calc(100%-60px)] h-full bg-white dark:bg-black transition-colors duration-300">
            {/* 👇 3. GESTION DE L'AFFICHAGE SELON LA VUE */}
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
"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from "@/components/Sidebar";
import TradingSection from "@/components/TradingSection";
import PositionsSection from "@/components/PositionsSection";
import { FaucetDialog } from "@/components/FaucetDialog";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { useAccount } from 'wagmi';

const Index: React.FC = () => {
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true); // <-- overlay visible au premier rendu

  // Bouton pour fermer l’overlay
  const handleDismissWelcome = () => {
    setShowWelcome(false);
  };

  return (
    <div className="antialiased bg-background">

      {/* Overlay affiché tant que showWelcome = true */}
      {showWelcome && <WelcomeOverlay onDismiss={handleDismissWelcome} />}

      {/* Sidebar */}
      <Sidebar setIsFaucetOpen={setIsFaucetOpen} />

      {/* Main Content */}
      <main className="ml-[60px] w-[calc(100%-60px)] h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
        <TradingSection />
        {/* <PositionsSection /> */}
      </main>

      {/* Faucet Dialog */}
      <FaucetDialog
        open={isFaucetOpen}
        onOpenChange={setIsFaucetOpen}
      />
    </div>
  );
};

export default Index;

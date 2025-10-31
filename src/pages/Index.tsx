import { useState } from 'react'; // 👈 Importation de useState
import Sidebar from "@/components/Sidebar";
import TradingSection from "@/components/TradingSection";
import PositionsSection from "@/components/PositionsSection";
import { FaucetDialog } from "@/components/FaucetDialog"; // 👈 Importation du FaucetDialog

const Index = () => {
  // 👈 État d'ouverture centralisé ici
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);

  // NOTE: Sidebar doit maintenant accepter 'setIsFaucetOpen' comme prop

  return (
    <div className="antialiased bg-background">
      {/* Fixed Sidebar */}
      {/* 👈 Passage de la fonction d'ouverture à la Sidebar */}
      <Sidebar setIsFaucetOpen={setIsFaucetOpen} />

      {/* Main Content Area with Scroll Snap */}
      <main className="ml-[60px] w-[calc(100%-60px)] h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
        {/* Section 1: Trading Interface */}
        <TradingSection />

        {/* Section 2: Positions Management */}
        <PositionsSection />
      </main>

      {/* 👈 Le FaucetDialog est rendu en dehors de la structure principale */}
      <FaucetDialog 
        open={isFaucetOpen} 
        onOpenChange={setIsFaucetOpen}
        // Utilise l'état simulé pour le moment
        simulatedState={'unclaimed'} 
      />
    </div>
  );
};

export default Index;
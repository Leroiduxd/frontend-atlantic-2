import { useState, useEffect } from 'react';
import Sidebar from "@/components/Sidebar";
import TradingSection from "@/components/TradingSection";
import PositionsSection from "@/components/PositionsSection";
import { FaucetDialog } from "@/components/FaucetDialog";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { useAccount } from 'wagmi'; 

const Index = () => {
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Récupérer l'état de connexion
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  // 1. Définir le montage
  useEffect(() => {
    setIsMounted(true);
  }, []); 

  // 2. Logique d'affichage de l'overlay (s'exécute seulement après le montage)
  useEffect(() => {
    // Si le composant n'est pas monté ou si Wagmi est en train de charger, on s'arrête.
    if (!isMounted || isConnecting || isReconnecting) {
      return;
    }

    // Si l'utilisateur est connecté, on n'affiche pas l'overlay (il n'est pas "nouveau")
    if (isConnected) {
        return;
    }

    // Vérifier si l'overlay a déjà été vu (localStorage est disponible ici)
    const hasSeenWelcome = localStorage.getItem('hasSeenBrokexWelcome');

    // Afficher si jamais vu ET non connecté
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }

  }, [isMounted, isConnected, isConnecting, isReconnecting]); 

  const handleDismissWelcome = () => {
    // Marquer comme vu pour toujours
    if (typeof localStorage !== 'undefined') {
       localStorage.setItem('hasSeenBrokexWelcome', 'true');
    }
    setShowWelcome(false);
  };

  return (
    <div className="antialiased bg-background">
      {/* Afficher l'overlay s'il est actif */}
      {showWelcome && <WelcomeOverlay onDismiss={handleDismissWelcome} />}

      {/* Fixed Sidebar */}
      <Sidebar setIsFaucetOpen={setIsFaucetOpen} />

      {/* Main Content Area with Scroll Snap */}
      <main className="ml-[60px] w-[calc(100%-60px)] h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
        {/* Section 1: Trading Interface */}
        <TradingSection />

        {/* Section 2: Positions Management */}
        <PositionsSection />
      </main>

      {/* Le FaucetDialog est rendu en dehors de la structure principale */}
      <FaucetDialog 
        open={isFaucetOpen} 
        onOpenChange={setIsFaucetOpen}
        // ... (props du FaucetDialog) ...
      />
    </div>
  );
};

export default Index;
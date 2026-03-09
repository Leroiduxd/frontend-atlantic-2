"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Sidebar from "@/components/Sidebar";
import TraderExplorerView from "@/components/TraderExplorerView";
import { useWebSocket } from '@/hooks/useWebSocket';

const TraderPage: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { data: wsData } = useWebSocket();

  if (!address) return null;

  return (
    <div className="antialiased bg-background dark:bg-black h-screen w-full flex overflow-hidden">
      {/* On garde la Sidebar pour la navigation */}
      <Sidebar 
          setIsFaucetOpen={() => {}} // À adapter selon ton besoin
          currentView="scan" // On marque 'scan' car c'est une vue d'exploration
          onNavigate={(view) => navigate('/')} // Retour à l'accueil pour les autres vues
      />

      <main className="ml-[60px] w-[calc(100%-60px)] h-full bg-white dark:bg-black overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Retour</span>
          </button>
          
          <TraderExplorerView address={address} wsData={wsData} />
        </div>
      </main>
    </div>
  );
};

export default TraderPage;
"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ====================================================================
// 1. COMPOSANT POUR LE DÉFILEMENT DES NOMBRES (maintenu)
// ====================================================================
interface CountingNumberProps {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

const CountingNumber: React.FC<CountingNumberProps> = ({ 
  end, 
  duration = 2000, // 2 secondes pour défiler
  decimals = 0,
  prefix = "",
  suffix = "" 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Utilisation d'une fonction de lissage (ease-out) pour un effet plus doux
      const easedProgress = 1 - Math.pow(1 - progress, 3); 
      const current = easedProgress * end;
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
    return () => { /* Cleanup si nécessaire */ };
  }, [end, duration]);

  // Utilisation de toLocaleString pour les séparateurs (ex: 1,400,000)
  const formattedCount = Math.floor(count).toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });

  return (
    <span className="text-blue-400 font-extrabold block text-4xl lg:text-6xl font-mono">
      {prefix}{formattedCount}{suffix}
    </span>
  );
};


// ====================================================================
// 2. COMPOSANT PRINCIPAL DE L'OVERLAY (Séquence fluide)
// ====================================================================
interface WelcomeOverlayProps {
  onDismiss: () => void;
}

// Les étapes et leur contenu
const STEPS = [
    { id: 1, text: "Brokex Protocol v2 is deployed on Pharos Atlantic Network.", duration: 3000, delay: 500, type: 'TEXT' },
    { id: 2, text: "Previous Testnet Success:", duration: 2500, endValue: 1400000, suffix: " Users", type: 'STAT' },
    { id: 3, text: "Total Unique Trades:", duration: 2500, endValue: 70000000, suffix: " Trades", type: 'STAT' },
    { id: 4, text: "Total Trading Volume:", duration: 2500, endValue: 35000000000, prefix: "$", suffix: " Volume", type: 'STAT' },
];

const SEQUENCE_TIMING = 3000; // Temps visible par slide (hors durée de comptage)

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onDismiss }) => {
  const [currentStep, setCurrentStep] = useState(0); // 0: Début, 1, 2, 3: Index des stats
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timers: NodeJS.Timeout[] = [];
    let delay = 0;

    // 0. Initialisation et apparition (Fondu entrant)
    setIsVisible(true); 
    
    // 1. Démarrer la séquence après un léger délai
    timers.push(setTimeout(() => setCurrentStep(1), 500));
    delay += 500;

    // 2. Séquence des étapes (TEXTE + COMPTEURS)
    STEPS.forEach((step, index) => {
        // Temps d'affichage + temps de transition avant la prochaine slide
        const stepDisplayTime = step.duration + 500; 
        
        timers.push(setTimeout(() => {
            setCurrentStep(step.id);
        }, delay));
        
        // Accumuler le délai total
        delay += stepDisplayTime; 
    });

    // 3. Fermeture de l'overlay (après toutes les slides)
    timers.push(setTimeout(handleSkip, delay + 1000)); // + 1s de marge


    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleSkip = () => {
    setIsVisible(false);
    // Attendre la fin de l'animation de fondu avant de détruire le composant
    setTimeout(onDismiss, 500); 
  };

  const renderStepContent = () => {
    const stepData = STEPS.find(s => s.id === currentStep);

    if (!stepData) return null;

    if (stepData.type === 'TEXT') {
        return (
            <h2 className="text-3xl lg:text-5xl font-bold transition-opacity duration-700 animate-pulse text-center">
                {stepData.text}
            </h2>
        );
    }

    if (stepData.type === 'STAT') {
        return (
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-300 transition-opacity duration-700">
                    {stepData.text}
                </h3>
                <CountingNumber 
                    end={stepData.endValue}
                    duration={SEQUENCE_TIMING} 
                    prefix={stepData.prefix}
                    suffix={stepData.suffix}
                />
            </div>
        );
    }
    
    return null;
  };

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Bouton pour fermer/passer */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-gray-400 hover:text-white hover:bg-white/10"
        onClick={handleSkip}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Contenu principal */}
      <div className="w-full max-w-3xl text-center text-white min-h-[150px] flex items-center justify-center">
        {renderStepContent()}
      </div>
    </div>
  );
};
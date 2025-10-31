"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from '@/hooks/useVault'; 
import { useToast } from '@/hooks/use-toast';
import { BanknoteArrowDown, BanknoteArrowUp, ArrowRight } from 'lucide-react'; 

type TransactionMode = 'deposit' | 'withdraw';

export const DepositDialog = () => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<TransactionMode>('deposit'); 
  
  const { deposit, withdraw, tokenBalance, refetchAll } = useVault();

  const { toast } = useToast();

  // --- Données du compte (Simulées) ---
  const simulatedWalletBalance = '999998999909000.00'; 
  const simulatedVaultBalance = 8500.00; 
  const simulatedUsedMargin = 1500.00;
  const simulatedAvailableBalance = simulatedVaultBalance - simulatedUsedMargin; 
  
  // Couleurs et classes
  const depositColor = 'text-trading-blue';
  const withdrawColor = 'text-red-500'; // Couleur d'action du rouge
  
  // NOUVELLES COULEURS DE FOND CLAIR ET FONCÉ
  const currentDarkBgColor = mode === 'deposit' ? 'bg-blue-100' : 'bg-red-50'; // Rouge beaucoup plus clair (bg-red-50)
  
  const currentActionColorClass = mode === 'deposit' ? 'bg-trading-blue hover:bg-trading-blue/90' : 'bg-trading-red hover:bg-trading-red/90';
  const CurrentMainIconColor = mode === 'deposit' ? depositColor : withdrawColor;

  // Détermine la valeur par défaut de l'input
  const defaultInputValue = useMemo(() => {
    if (mode === 'deposit') {
        return simulatedWalletBalance;
    }
    return simulatedAvailableBalance.toFixed(2);
  }, [mode, simulatedWalletBalance, simulatedAvailableBalance]);

  // Met à jour l'input avec la valeur par défaut lors du changement de mode ou d'ouverture
  useEffect(() => {
    if (open) {
        setAmount(defaultInputValue);
    }
  }, [mode, open, defaultInputValue]);

  // Composant pour l'icône principale (grande et décalée)
  const MainActionIcon = ({ Icon, color }: { Icon: React.ElementType, color: string }) => (
    // 🛑 LOGO PLUS GRAND (650px) et DÉCALÉ VERS LA DROITE (left-25%)
    <div className={`absolute top-1/2 -translate-y-1/2 -left-[25%] flex items-center justify-center h-full w-full`}>
      <Icon className={`w-[650px] h-[650px] ${color} opacity-30 z-0`} /> 
    </div>
  );

  const handleTransaction = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (mode === 'deposit') {
        await deposit(amount);
        toast({ title: 'Deposit successful', description: `Deposited $${amount}` });
      } else {
        await withdraw(amount);
        toast({ title: 'Withdrawal successful', description: `Withdrew $${amount}` });
      }
      setAmount(defaultInputValue); 
      setOpen(false);
      setTimeout(() => refetchAll(), 2000);
    } catch (error: any) {
      toast({ title: `${mode} failed`, description: error?.message || 'Transaction failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const CurrentIconComponent = mode === 'deposit' ? BanknoteArrowDown : BanknoteArrowUp;
  const currentActionLabel = mode === 'deposit' ? 'Deposit' : 'Withdraw';


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="text-xs font-semibold">
          Deposit
        </Button>
      </DialogTrigger>
      
      {/* Container de la modale: Fond BLANC par défaut */}
      <DialogContent className={`w-[650px] max-w-none p-0 shadow-xl rounded-lg min-h-[450px] overflow-hidden bg-white`}>
        
        {/* En-tête de contrôle: Boutons compacts à droite */}
        <div className="absolute top-4 right-4 z-20 flex space-x-2">
            <Button
              onClick={() => setMode('deposit')}
              className={`text-sm h-7 px-3 ${mode === 'deposit' ? 'bg-trading-blue hover:bg-trading-blue/80 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              size="sm"
            >
              Deposit
            </Button>
            <Button
              onClick={() => setMode('withdraw')}
              className={`text-sm h-7 px-3 ${mode === 'withdraw' ? 'bg-trading-red hover:bg-trading-red/80 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              size="sm"
            >
              Withdraw
            </Button>
        </div>


        {/* Corps principal : Disposition deux colonnes 42% (Foncé) et 58% (Blanc) */}
        <div className="relative flex h-full min-h-[450px]">
          
          {/* Section gauche (42%) : Icône principale, Fond plus foncé */}
          <div className={`w-[42%] p-8 relative ${currentDarkBgColor}`}>
            <MainActionIcon Icon={CurrentIconComponent} color={CurrentMainIconColor} />
            
            {/* Espace vide intentionnel pour l'effet SVG */}
            <div className="relative z-10 text-base font-mono text-gray-800 space-y-2 mt-auto">
              {/* Le contenu de cette section est vide sauf pour l'icône */}
            </div>

          </div>

          {/* Section droite (58%) : Balances, Input et Bouton (Fond BLANC) */}
          <div className="w-[58%] p-8 flex flex-col justify-between items-end space-y-8 bg-white">
            
            {/* 1. Balances (Haut de la zone) - Taille de police réduite */}
            <div className="w-full text-xs font-mono text-gray-800 space-y-1 pt-8">
                <p className="flex justify-between items-center">
                    Wallet Balance: <span className="font-semibold text-foreground">${simulatedWalletBalance}</span>
                </p>
                <p className="flex justify-between items-center">
                    Total Vault Balance: <span className="font-semibold text-foreground">${simulatedVaultBalance.toFixed(2)}</span>
                </p>
                <p className="flex justify-between items-center">
                    Used Margin: <span className="font-semibold text-foreground">${simulatedUsedMargin.toFixed(2)}</span>
                </p>
                <p className="flex justify-between items-center pt-2 text-sm font-bold" style={{ color: CurrentMainIconColor }}>
                    Available Balance: <span>${simulatedAvailableBalance.toFixed(2)}</span>
                </p>
            </div>
            
            {/* 2. Titre et Conteneur Input + Bouton (Bas de la zone) */}
            <div className="w-full space-y-4 mt-auto">
                <h2 className="text-xl font-semibold w-full text-gray-800 text-right">
                    {currentActionLabel} Amount
                </h2>

                {/* Conteneur Input + Bouton collés */}
                <div className="w-full flex space-x-0 items-center">
                    
                    {/* Input du montant */}
                    <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        // Coins arrondis SEULEMENT à gauche (supérieur et inférieur)
                        className="flex-grow h-10 text-base text-right bg-white border-gray-300 font-mono rounded-r-none"
                        step="0.01"
                    />
                    
                    {/* Bouton d'Action */}
                    <Button
                        onClick={handleTransaction}
                        disabled={loading || !amount}
                        // Coins arrondis SEULEMENT à droite (supérieur et inférieur)
                        className={`h-10 px-4 text-base font-semibold ${currentActionColorClass} flex items-center rounded-l-none`}
                    >
                        {loading ? '...' : (
                            <>
                                {currentActionLabel} <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
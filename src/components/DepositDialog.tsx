"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVault } from '@/hooks/useVault'; 
import { useToast } from '@/hooks/use-toast';
import { BanknoteArrowDown, BanknoteArrowUp, ArrowRight, Wallet } from 'lucide-react'; 
import { useVaultBalances } from '@/hooks/useVaultBalances'; 
import { useAccount } from 'wagmi'; 

type TransactionMode = 'deposit' | 'withdraw';

// 1. DÉFINITION DE L'INTERFACE DES PROPS
interface DepositDialogProps {
    className?: string;
}

// 2. MISE À JOUR DE LA SIGNATURE POUR ACCEPTER CLASSNAME
export const DepositDialog = ({ className }: DepositDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<TransactionMode>('deposit'); 
  
  const { deposit, withdraw, refetchAll } = useVault(); 
  const { walletBalance, totalBalance, lockedMargin, availableBalance, refetchAll: refetchBalances } = useVaultBalances();
  
  const { isConnected } = useAccount();
  const { toast } = useToast();

  // --- Display Data ---
  const simulatedWalletBalance = walletBalance; 
  const simulatedVaultBalance = totalBalance; 
  const simulatedUsedMargin = lockedMargin;
  const simulatedAvailableBalance = availableBalance; 
  
  // Colors and Classes
  const depositColor = 'text-trading-blue';
  const withdrawColor = 'text-red-500'; 
  const currentDarkBgColor = mode === 'deposit' ? 'bg-blue-100' : 'bg-red-50'; 
  const currentActionColorClass = mode === 'deposit' ? 'bg-trading-blue hover:bg-trading-blue/90' : 'bg-trading-red hover:bg-trading-red/90';
  const CurrentMainIconColor = mode === 'deposit' ? depositColor : withdrawColor;

  // Conversion balances to numbers for validation
  const numericWalletBalance = useMemo(() => parseFloat(walletBalance.replace(/,/g, '')) || 0, [walletBalance]);
  const numericAvailableBalance = useMemo(() => availableBalance, [availableBalance]);

  // Determines the maximum authorized balance for the current action
  const maxAmount = useMemo(() => {
    return mode === 'deposit' ? numericWalletBalance : numericAvailableBalance;
  }, [mode, numericWalletBalance, numericAvailableBalance]);

  // Determines the default input value
  const defaultInputValue = useMemo(() => {
    if (mode === 'deposit') {
        return walletBalance; 
    }
    return availableBalance.toFixed(2); 
  }, [mode, walletBalance, availableBalance]);

  // Updates the input with the default value on mode change or open
  useEffect(() => {
    if (open && isConnected) {
        setAmount(defaultInputValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, defaultInputValue, isConnected]);

  // Component for the main icon (unchanged)
  const MainActionIcon = ({ Icon, color }: { Icon: React.ElementType, color: string }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 -left-[25%] flex items-center justify-center h-full w-full`}>
      <Icon className={`w-[650px] h-[650px] ${color} opacity-30 z-0`} /> 
    </div>
  );

  // Toast message for disconnected state
  const showConnectWalletToast = useCallback(() => {
    toast({ 
        title: "Connection Required", 
        description: "Please connect your wallet to proceed.", 
        variant: "destructive" 
    });
  }, [toast]);

  // Input handler (to cap input)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value === '') {
      setAmount('');
      return;
    }

    const numericValue = parseFloat(value);

    if (isNaN(numericValue)) {
      return;
    }

    // Cap the input value to the maximum authorized amount
    if (numericValue > maxAmount) {
      setAmount(maxAmount.toFixed(2));
    } else {
      setAmount(value);
    }
  };

  const handleTransaction = async () => {
    if (!isConnected) {
        return showConnectWalletToast();
    }
    
    const numericAmount = Number(amount);

    if (!amount || numericAmount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    
    if (numericAmount > maxAmount) {
        toast({
            title: 'Insufficient Funds',
            description: `You cannot ${mode} more than your available balance.`,
            variant: 'destructive',
        });
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
      if (mode === 'deposit') {
        await deposit(amount);
      } else {
        await withdraw(amount);
      }
      toast({ title: `${mode} successful`, description: `${mode}ed $${amount}` });
      setAmount(defaultInputValue); 
      setOpen(false);
      
      setTimeout(() => {
        refetchAll();
        refetchBalances();
      }, 2000); 

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
        {/* 3. APPLICATION DU CLASSNAME AU BOUTON */}
        <Button 
            variant="secondary" 
            size="sm" 
            className={`text-xs font-semibold ${className}`}
        >
          Deposit
        </Button>
      </DialogTrigger>
      
      {/* Container de la modale */}
      <DialogContent className={`w-[650px] max-w-none p-0 shadow-xl rounded-lg min-h-[450px] overflow-hidden bg-white`}>
        
        {/* Affichage conditionnel basé sur l'état de connexion */}
        {!isConnected ? (
             <div className="text-center py-12 px-8 flex flex-col items-center justify-center min-h-[450px]">
                <Wallet className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Wallet Connection Required</h3>
                <p className="text-gray-600 mb-6">
                    Please connect your wallet to deposit or withdraw funds.
                </p>
                <div className="mx-auto w-fit">
                   <Button 
                    onClick={showConnectWalletToast}
                    className="bg-trading-blue hover:bg-trading-blue/90"
                   >
                    Connect Wallet
                   </Button> 
                </div>
            </div>
        ) : (
        <>
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


            {/* Corps principal : Disposition deux colonnes */}
            <div className="relative flex h-full min-h-[450px]">
              
              {/* Section gauche (42%) : Icône principale, Fond plus foncé */}
              <div className={`w-[42%] p-8 relative ${currentDarkBgColor}`}>
                <MainActionIcon Icon={CurrentIconComponent} color={CurrentMainIconColor} />
                
                <div className="relative z-10 text-base font-mono text-gray-800 space-y-2 mt-auto">
                  {/* Contenu vide pour mettre en valeur l'icône */}
                </div>

              </div>

              {/* Section droite (58%) : Balances, Input et Bouton (Fond BLANC) */}
              <div className="w-[58%] p-8 flex flex-col justify-between items-end space-y-8 bg-white">
                
                {/* 1. Balances (Haut de la zone) */}
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
                        
                        {/* 🛑 INPUT SANS FLÈCHES DE NAVIGATION (SPIN BUTTONS) */}
                        <Input
                            type="number"
                            value={amount}
                            onChange={handleAmountChange} 
                            // CLASSE CRITIQUE POUR CACHER LES FLÈCHES
                            className="flex-grow h-10 text-base text-right bg-white border-gray-300 font-mono rounded-r-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            step="0.01"
                            placeholder="0.00"
                        />
                        
                        {/* Bouton d'Action */}
                        <Button
                            onClick={handleTransaction}
                            disabled={loading || !amount}
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
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};
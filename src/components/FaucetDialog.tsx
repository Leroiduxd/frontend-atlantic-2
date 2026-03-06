"use client";

import React, { useState, useEffect } from 'react';
import { Droplet, DollarSign, CheckCircle, Wallet, ArrowDownToLine } from 'lucide-react'; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFaucet } from '@/hooks/useFaucet'; 
import { useToast } from "@/hooks/use-toast";
import { useAccount } from 'wagmi'; 

// L'IMPORT DE TA MODAL DE DÉPÔT
import { DepositDialog } from "@/components/DepositDialog";

interface FaucetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorContext?: 'lowBalance' | 'transactionError' | null;
}

export const FaucetDialog: React.FC<FaucetDialogProps> = ({ open, onOpenChange, errorContext }) => {
  const { toast } = useToast();
  const { isConnected } = useAccount(); 
  
  const [countdown, setCountdown] = useState<string | null>(null);

  const { 
    hasClaimed, 
    isLoadingClaimStatus, 
    isClaiming, 
    claimTestTokens,
    isApproved, 
    isApproving,
    approveVault,
    nextEligibleAt 
  } = useFaucet();

  // --- LOGIQUE DU COMPTEUR ---
  useEffect(() => {
    if (!hasClaimed || !nextEligibleAt) {
        setCountdown(null);
        return;
    }

    const updateTimer = () => {
        const now = Math.floor(Date.now() / 1000);
        const diff = Number(nextEligibleAt) - now;

        if (diff <= 0) {
            setCountdown(null); 
        } else {
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            setCountdown(`${h}h ${m}m ${s}s`);
        }
    };

    updateTimer(); 
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasClaimed, nextEligibleAt]);

  const showConnectWalletToast = () => {
    toast({ 
        title: "Connection Required", 
        description: "Please connect your wallet to proceed.", 
        variant: "destructive" 
    });
  };

  const handleClaim = async () => {
    if (!isConnected) return showConnectWalletToast();
    try {
        await claimTestTokens();
        toast({ title: "Claim Successful", description: "Test funds claimed!" });
    } catch (error: any) {
        toast({ title: "Claim Failed", description: error?.shortMessage || error?.message || "Transaction failed.", variant: "destructive" });
    }
  };

  const handleApprove = async () => {
    if (!isConnected) return showConnectWalletToast();
    try {
        await approveVault(); 
        toast({ title: "Approval Successful", description: "Vault approved for infinite USDC." });
    } catch (error: any) {
        toast({ title: "Approval Failed", description: error?.shortMessage || error?.message || "Transaction failed.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Conteneur Principal */}
      <DialogContent className="w-[500px] max-w-[95vw] p-6 bg-white dark:bg-[#1c1c1e] shadow-xl rounded-xl dark:border dark:border-zinc-800">
        
        {isConnected ? (
          <div className="flex flex-col">
            
            {/* EN-TÊTE */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Account Setup</h2>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                    Complete these steps to initialize your trading account.
                </p>
            </div>

            <div className="flex flex-col gap-4 relative">
                
                {/* Ligne de connexion visuelle */}
                <div className="absolute left-[1.15rem] top-10 bottom-10 w-0.5 bg-gray-300 dark:bg-zinc-800 z-0"></div>

                {/* --- ÉTAPE 1 : CLAIM --- */}
                <div className={`relative z-10 flex items-center justify-between p-4 rounded-xl border transition-all duration-300
                    ${hasClaimed 
                        ? 'border-blue-200 dark:border-zinc-800 bg-blue-50/80 dark:bg-[#1c1c1e]' 
                        : 'border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-[#0a0a0a] shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors
                            ${hasClaimed 
                                ? 'bg-blue-100 text-blue-600 dark:bg-zinc-800 dark:text-white' 
                                : 'bg-blue-600 text-white dark:bg-white dark:text-black'
                            }`}
                        >
                            {hasClaimed ? <CheckCircle className="w-5 h-5" /> : <Droplet className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">1. Claim Test Tokens</h3>
                            <p className="text-xs text-gray-600 dark:text-zinc-400">Get 1,000 USDC every 24H.</p>
                        </div>
                    </div>

                    <Button
                        onClick={handleClaim}
                        disabled={hasClaimed || isClaiming || isLoadingClaimStatus || countdown !== null}
                        size="sm"
                        className={`font-semibold transition-colors duration-300 min-w-[100px]
                            ${hasClaimed 
                                ? 'bg-transparent text-blue-600 hover:bg-blue-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white border border-transparent cursor-default' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#0a0a0a] dark:border dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-white'
                            }`}
                    >
                        {isClaiming ? 'Claiming...' : (countdown ? countdown : 'Claim')}
                    </Button>
                </div>


                {/* --- ÉTAPE 2 : APPROVE --- */}
                <div className={`relative z-10 flex items-center justify-between p-4 rounded-xl border transition-all duration-300
                    ${!hasClaimed ? 'opacity-50 grayscale pointer-events-none' : ''}
                    ${isApproved 
                        ? 'border-blue-200 dark:border-zinc-800 bg-blue-50/80 dark:bg-[#1c1c1e]' 
                        : (hasClaimed ? 'border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-[#0a0a0a] shadow-sm' : 'border-transparent bg-transparent')
                    }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors
                            ${isApproved 
                                ? 'bg-blue-100 text-blue-600 dark:bg-zinc-800 dark:text-white' 
                                : (hasClaimed ? 'bg-blue-600 text-white dark:bg-white dark:text-black' : 'bg-gray-300 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500')
                            }`}
                        >
                            {isApproved ? <CheckCircle className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">2. Approve Vault</h3>
                            <p className="text-xs text-gray-600 dark:text-zinc-400">Allow trading with USDC.</p>
                        </div>
                    </div>

                    <Button
                        onClick={handleApprove}
                        disabled={!hasClaimed || isApproved || isApproving} 
                        size="sm"
                        className={`font-semibold transition-colors duration-300 min-w-[100px]
                            ${isApproved 
                                ? 'bg-transparent text-blue-600 hover:bg-blue-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white border border-transparent' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#0a0a0a] dark:border dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-white'
                            }`}
                    >
                        {isApproving ? 'Approving...' : (isApproved ? 'Done' : 'Approve')}
                    </Button>
                </div>


                {/* --- ÉTAPE 3 : DEPOSIT --- */}
                <div className={`relative z-10 flex items-center justify-between p-4 rounded-xl border transition-all duration-300
                    ${!isApproved ? 'opacity-50 grayscale pointer-events-none' : ''}
                    ${isApproved ? 'border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-[#0a0a0a] shadow-sm' : 'border-transparent bg-transparent'}
                    `}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors
                            ${isApproved ? 'bg-blue-600 text-white dark:bg-white dark:text-black' : 'bg-gray-300 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500'}`}
                        >
                            <ArrowDownToLine className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">3. Deposit Funds</h3>
                            <p className="text-xs text-gray-600 dark:text-zinc-400">Fund your account to trade.</p>
                        </div>
                    </div>

                    {/* ICI LA CORRECTION : J'inclus directement DepositDialog */}
                    <div onClick={() => isApproved && onOpenChange(false)}>
                        <DepositDialog 
                            className={`h-9 px-4 text-sm font-semibold rounded-md transition-colors duration-300 min-w-[100px] border-none shadow-none
                                ${isApproved 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-[#0a0a0a] dark:border dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-white' 
                                    : 'bg-transparent text-transparent pointer-events-none' /* On le cache subtilement si pas approuvé pour éviter le double bouton */
                                }
                            `} 
                        />
                        {/* Si pas approuvé, on affiche un faux bouton grisé à la place pour le visuel */}
                        {!isApproved && (
                             <Button
                                disabled={true} 
                                size="sm"
                                className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold transition-colors duration-300 min-w-[100px] bg-gray-300 text-gray-500 dark:bg-zinc-800 dark:text-zinc-600"
                            >
                                Deposit
                            </Button>
                        )}
                    </div>
                </div>

            </div>

            {/* MESSAGE FINAL */}
            {isApproved && hasClaimed && (
                <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-400">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    You are all set! You can now deposit funds to trade.
                </div>
            )}

          </div>
        ) : (
            // VUE DECONNEXION
            <div className="text-center py-10 flex flex-col items-center justify-center bg-white dark:bg-[#1c1c1e]">
                <div className="w-16 h-16 bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-zinc-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Wallet className="w-8 h-8 text-gray-500 dark:text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-[280px]">
                    Please connect your wallet to access the Faucet and approve the Vault.
                </p>
              </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
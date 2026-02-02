"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Droplet, DollarSign, CheckCircle, Wallet } from 'lucide-react'; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFaucet } from '@/hooks/useFaucet'; 
import { useToast } from "@/hooks/use-toast";
import { useAccount } from 'wagmi'; 

// Définitions des props
interface FaucetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorContext?: 'lowBalance' | 'transactionError' | null;
}

export const FaucetDialog: React.FC<FaucetDialogProps> = ({ open, onOpenChange, errorContext }) => {
  const { toast } = useToast();
  const { isConnected } = useAccount(); 

  const { 
    hasClaimed, 
    isLoadingClaimStatus, 
    isClaiming, 
    claimTestTokens,
    isApproved, 
    isApproving,
    approveVault,
  } = useFaucet();

  // --- COULEURS DYNAMIQUES (Light Blue / Dark Zinc) ---
  const primaryColor = 'text-blue-600 dark:text-blue-400';
  // Succès en bleu au lieu de vert pour le mode clair
  const successColor = 'text-blue-700 dark:text-blue-300'; 
  const bgColor = 'bg-blue-50 dark:bg-zinc-900';

  // Composant BackgroundIcon (Adapté Dark Mode)
  const BackgroundIcon = ({ Icon, isDone }: { Icon: React.ElementType, isDone: boolean }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 -left-1/3 flex items-center justify-center transition-opacity duration-300 ${isDone ? 'opacity-20' : 'opacity-10'}`}>
        <Icon className={`w-[300px] h-[300px] ${isDone ? successColor : primaryColor} z-0`} /> 
    </div>
  );
  
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
        toast({ title: "Approval Successful", description: "Vault approved for infinite TUSD." });
    } catch (error: any) {
        toast({ title: "Approval Failed", description: error?.shortMessage || error?.message || "Transaction failed.", variant: "destructive" });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Conteneur Principal : Blanc (Light) vs Zinc-950 (Dark) */}
      <DialogContent className="w-[650px] max-w-none p-0 bg-white dark:bg-zinc-950 shadow-xl rounded-lg dark:border-zinc-800">
        
        {isConnected ? (
          <div className="flex p-0">
            
            {/* 1. BLOC CLAIM */}
            <div className={`flex-1 p-8 relative overflow-hidden flex flex-col justify-between ${bgColor} min-h-[450px] rounded-l-lg border-r border-white/50 dark:border-zinc-800`}>
                <BackgroundIcon Icon={Droplet} isDone={hasClaimed} />

                <div className="relative z-10">
                    <div className="flex items-center mb-4">
                        <Droplet className={`w-6 h-6 mr-2 ${hasClaimed ? successColor : primaryColor}`} />
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Claim Tokens</h3>
                    </div>
                    
                    {hasClaimed ? (
                        <div className="flex items-center text-blue-800 dark:text-blue-300 font-medium h-[60px]">
                            <CheckCircle className={`w-5 h-5 mr-2 ${successColor}`} />
                            Tokens claimed.
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6 h-[60px]">
                            Receive test tokens required to start trading.
                        </p>
                    )}
                </div>

                {/* Bouton Claim */}
                <Button
                  onClick={handleClaim}
                  disabled={hasClaimed || isClaiming || isLoadingClaimStatus}
                  className={`relative z-10 w-full font-semibold transition-colors duration-300 
                    ${hasClaimed 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white'
                    }`}
                >
                    {isClaiming ? 'Claiming...' : (hasClaimed ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" /> 
                        Claimed
                      </>
                    ) : (
                      'Claim TUSD'
                    ))}
                </Button>
            </div>


            {/* 2. BLOC APPROVE */}
            <div className={`flex-1 p-8 relative overflow-hidden flex flex-col justify-between ${bgColor} min-h-[350px] rounded-r-lg`}>
                <BackgroundIcon Icon={DollarSign} isDone={isApproved} />

                <div className="relative z-10">
                    <div className="flex items-center mb-4">
                        <DollarSign className={`w-6 h-6 mr-2 ${isApproved ? successColor : primaryColor}`} />
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Approve Vault</h3>
                    </div>

                    {isApproved ? (
                        <div className="flex items-center text-blue-800 dark:text-blue-300 font-medium h-[60px]">
                            <CheckCircle className={`w-5 h-5 mr-2 ${successColor}`} />
                            Vault approved. Ready to trade!
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6 h-[60px]">
                            Grant the Vault permission to spend your TUSD tokens.
                        </p>
                    )}
                </div>

                {/* Bouton Approve */}
                <Button
                  onClick={handleApprove}
                  disabled={!hasClaimed || isApproved || isApproving} 
                  className={`relative z-10 w-full font-semibold transition-colors duration-300 
                    ${isApproved 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white'
                    }`}
                >
                    {isApproving ? 'Approving...' : (isApproved ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approved
                      </>
                    ) : (
                      'Approve TUSD (Infinite)'
                    ))}
                </Button>
            </div>
            
          </div>
        ) : (
             // VUE DECONNEXION (DARK MODE COMPATIBLE)
             <div className="text-center py-12 px-8 flex flex-col items-center justify-center min-h-[450px] bg-white dark:bg-zinc-950">
                <Wallet className="w-12 h-12 text-gray-400 dark:text-zinc-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Wallet Connection Required</h3>
                <p className="text-gray-600 dark:text-zinc-400 mb-6">
                    Please connect your wallet to access the Faucet, claim test tokens, and approve the Vault for trading.
                </p>
              </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
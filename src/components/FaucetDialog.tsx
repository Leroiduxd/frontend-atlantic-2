"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Droplet, DollarSign, CheckCircle, Wallet } from 'lucide-react'; 
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFaucet } from '@/hooks/useFaucet'; // Import du hook fonctionnel
import { useToast } from "@/hooks/use-toast";

// Définitions des props pour le contrôle
interface FaucetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optionnel: peut être utilisé pour forcer l'ouverture en cas d'erreur de trading
  errorContext?: 'lowBalance' | 'transactionError' | null;
}

export const FaucetDialog: React.FC<FaucetDialogProps> = ({ open, onOpenChange, errorContext }) => {
  const { toast } = useToast();
  const { 
    hasClaimed, 
    isLoadingClaimStatus, 
    isClaiming, 
    claimTestTokens,
    tokenBalance,
    isApproved, // État d'approbation infinie
    isApproving,
    approveVault,
    refetch,
  } = useFaucet();

  // Couleurs et classes
  const primaryColor = 'text-trading-blue';
  const successColor = 'text-green-500'; 
  const bgColor = 'bg-blue-50';
  const isConnected = true; // On suppose la connexion est gérée par le contexte Wagmi/RainbowKit

  // Composant pour l'arrière-plan de l'icône
  const BackgroundIcon = ({ Icon, isDone }: { Icon: React.ElementType, isDone: boolean }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 -left-1/3 flex items-center justify-center transition-opacity duration-300 ${isDone ? 'opacity-20' : 'opacity-10'}`}>
        <Icon className={`w-[300px] h-[300px] ${isDone ? successColor : primaryColor} z-0`} /> 
    </div>
  );
  
  // Fonction de gestion du Claim
  const handleClaim = async () => {
    try {
        await claimTestTokens();
        toast({ title: "Claim Successful", description: "Test funds claimed!" });
    } catch (error: any) {
        toast({ title: "Claim Failed", description: error?.shortMessage || "Transaction failed.", variant: "destructive" });
    }
  };

  // Fonction de gestion de l'Approbation
  const handleApprove = async () => {
    try {
        await approveVault(); // Approbation infinie
        toast({ title: "Approval Successful", description: "Vault approved for infinite TUSD." });
    } catch (error: any) {
        toast({ title: "Approval Failed", description: error?.shortMessage || "Transaction failed.", variant: "destructive" });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[650px] max-w-none p-0 bg-white shadow-xl rounded-lg">
        
        {/* Vérifier l'état de la connexion (simplifié ici, car useAccount est utilisé dans le hook) */}
        {isConnected ? (
          <div className="flex p-0">
            
            {/* 1. BLOC CLAIM (Goutte) - Gauche */}
            <div className={`flex-1 p-8 relative overflow-hidden flex flex-col justify-between ${bgColor} min-h-[450px] rounded-l-lg`}>
                <BackgroundIcon Icon={Droplet} isDone={hasClaimed} />

                <div className="relative z-10">
                    <div className="flex items-center mb-4">
                        <Droplet className={`w-6 h-6 mr-2 ${hasClaimed ? successColor : primaryColor}`} />
                        <h3 className="font-semibold text-lg text-gray-800">Claim Tokens</h3>
                    </div>
                    
                    {hasClaimed ? (
                        <div className="flex items-center text-green-700 font-medium h-[60px]">
                            <CheckCircle className={`w-5 h-5 mr-2 ${successColor}`} />
                            Tokens claimed.
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600 mb-6 h-[60px]">
                            Receive test tokens required to start trading.
                        </p>
                    )}
                </div>

                {/* Bouton Claim */}
                <Button
                  onClick={handleClaim}
                  disabled={hasClaimed || isClaiming || isLoadingClaimStatus}
                  className={`relative z-10 w-full font-semibold transition-colors duration-300 ${hasClaimed ? 'bg-green-500 hover:bg-green-600' : 'bg-trading-blue hover:bg-trading-blue/90'}`}
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


            {/* 2. BLOC APPROVE (Signe Dollar) - Droite */}
            <div className={`flex-1 p-8 relative overflow-hidden flex flex-col justify-between ${bgColor} min-h-[350px] rounded-r-lg border-l border-white/50`}>
                <BackgroundIcon Icon={DollarSign} isDone={isApproved} />

                <div className="relative z-10">
                    <div className="flex items-center mb-4">
                        <DollarSign className={`w-6 h-6 mr-2 ${isApproved ? successColor : primaryColor}`} />
                        <h3 className="font-semibold text-lg text-gray-800">Approve Vault</h3>
                    </div>

                    {isApproved ? (
                        <div className="flex items-center text-green-700 font-medium h-[60px]">
                            <CheckCircle className={`w-5 h-5 mr-2 ${successColor}`} />
                            Vault approved. Ready to trade!
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600 mb-6 h-[60px]">
                            Grant the Vault permission to spend your TUSD tokens.
                        </p>
                    )}
                </div>

                {/* Bouton Approve */}
                <Button
                  onClick={handleApprove}
                  disabled={!hasClaimed || isApproved || isApproving} // Désactivé si non Claimed, déjà Approved ou en cours
                  className={`relative z-10 w-full font-semibold transition-colors duration-300 ${isApproved ? 'bg-green-500 hover:bg-green-600' : 'bg-trading-blue hover:bg-trading-blue/90'}`}
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
             <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Connect your wallet to access the Faucet.</p>
                <div className="mx-auto w-fit">
                   <Button className="bg-trading-blue hover:bg-trading-blue/90" disabled={true}>Connect Wallet</Button> 
                </div>
              </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
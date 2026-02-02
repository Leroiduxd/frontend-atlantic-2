"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useVault } from '@/hooks/useVault';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { useFaucet } from '@/hooks/useFaucet';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Droplet, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ConnectButton } from '@rainbow-me/rainbowkit'; // OU ton composant de connexion habituel

export const WalletView = () => {
  const { isConnected } = useAccount();
  const { toast } = useToast();
  
  // --- HOOKS VAULT & BALANCES ---
  const { deposit, withdraw, refetchAll } = useVault();
  const { walletBalance, availableBalance, lockedMargin, refetchAll: refetchBalances } = useVaultBalances();
  
  // --- HOOK FAUCET ---
  const { 
    hasClaimed, 
    isClaiming, 
    claimTestTokens,
    isApproved, 
    isApproving,
    approveVault,
    isLoadingClaimStatus
  } = useFaucet();

  // --- ÉTATS LOCAUX ---
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [isTransacting, setIsTransacting] = useState(false);

  // --- CALCULS ---
  const numericWalletBalance = useMemo(() => parseFloat(walletBalance.replace(/,/g, '')) || 0, [walletBalance]);
  
  const maxAmount = mode === 'deposit' ? numericWalletBalance : availableBalance;

  // --- HANDLERS ---
  const handleSetMax = () => {
    setAmount(maxAmount.toString());
  };

  const handleTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setIsTransacting(true);
    try {
      if (mode === 'deposit') {
        await deposit(amount);
      } else {
        await withdraw(amount);
      }
      toast({ title: "Success", description: `${mode === 'deposit' ? 'Deposited' : 'Withdrawn'} ${amount} TUSD` });
      setAmount('');
      setTimeout(() => { refetchAll(); refetchBalances(); }, 2000);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsTransacting(false);
    }
  };

  // --- RENDER : NOT CONNECTED ---
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6 bg-white dark:bg-black">
        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
          <Wallet className="w-10 h-10 text-slate-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-slate-500 dark:text-zinc-400">
            Connect your wallet to manage your funds, claim test tokens, and start trading.
          </p>
        </div>
        {/* Adapte ce bouton selon ta librairie (RainbowKit, Web3Modal, etc.) */}
        <div className="custom-connect-button-wrapper">
             <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black overflow-y-auto pb-24">
      
      {/* 1. BALANCE CARD */}
      <div className="p-4 bg-white dark:bg-black border-b border-gray-100 dark:border-zinc-800">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Equity (Vault)</span>
        <div className="text-4xl font-bold mt-1 mb-4 dark:text-white">
          ${(availableBalance + parseFloat(lockedMargin)).toFixed(2)}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
            <span className="text-[10px] text-slate-500 block">Available Margin</span>
            <span className="font-mono font-semibold dark:text-white">${availableBalance.toFixed(2)}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
            <span className="text-[10px] text-slate-500 block">Used Margin</span>
            <span className="font-mono font-semibold dark:text-white">${lockedMargin}</span>
          </div>
        </div>
      </div>

      {/* 2. FAUCET SECTION (Si nécessaire) */}
      {(!hasClaimed || !isApproved) && !isLoadingClaimStatus && (
        <div className="p-4">
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <h3 className="font-bold text-amber-700 dark:text-amber-500 flex items-center gap-2 mb-3">
              <Droplet className="w-4 h-4" /> Setup Account
            </h3>
            
            <div className="space-y-3">
              {/* Étape 1 : Claim */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-800 dark:text-amber-200">1. Get 10,000 TUSD</span>
                {hasClaimed ? (
                  <span className="text-green-600 flex items-center text-xs font-bold"><CheckCircle className="w-4 h-4 mr-1"/> Done</span>
                ) : (
                  <Button size="sm" onClick={() => claimTestTokens()} disabled={isClaiming} className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
                    {isClaiming ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Claim'}
                  </Button>
                )}
              </div>

              {/* Étape 2 : Approve */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-800 dark:text-amber-200">2. Approve Vault</span>
                {isApproved ? (
                  <span className="text-green-600 flex items-center text-xs font-bold"><CheckCircle className="w-4 h-4 mr-1"/> Done</span>
                ) : (
                  <Button size="sm" onClick={() => approveVault()} disabled={!hasClaimed || isApproving} className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
                    {isApproving ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Approve'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 3. ACTIONS (Deposit / Withdraw) */}
      <div className="p-4 flex-1">
        {/* Tabs */}
        <div className="flex p-1 bg-white dark:bg-zinc-900 rounded-xl mb-6 border border-gray-100 dark:border-zinc-800">
          <button
            onClick={() => setMode('deposit')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
              ${mode === 'deposit' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
          >
            <ArrowDownToLine className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => setMode('withdraw')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2
              ${mode === 'withdraw' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
          >
            <ArrowUpFromLine className="w-4 h-4" /> Withdraw
          </button>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Amount</span>
              <span>Max: {maxAmount.toFixed(2)} TUSD</span>
            </div>
            
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-14 text-xl font-mono pl-4 pr-20 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 rounded-xl focus-visible:ring-0 focus-visible:border-blue-500"
              />
              <button 
                onClick={handleSetMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded"
              >
                MAX
              </button>
            </div>
          </div>

          <Button 
            onClick={handleTransaction}
            disabled={isTransacting || !amount || parseFloat(amount) <= 0}
            className={`w-full h-12 text-lg font-bold shadow-lg transition-transform active:scale-[0.98] rounded-xl
              ${mode === 'deposit' 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' 
                : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
          >
            {isTransacting ? <Loader2 className="animate-spin" /> : (mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw')}
          </Button>

          {mode === 'deposit' && (
            <p className="text-xs text-center text-slate-400 mt-2">
              Wallet Balance: <span className="text-slate-900 dark:text-white font-mono">${walletBalance}</span>
            </p>
          )}
        </div>
      </div>

    </div>
  );
};
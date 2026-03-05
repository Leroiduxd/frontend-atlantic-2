"use client";

import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useReadContracts, 
  usePublicClient,
  useChainId,       // <-- Ajouté
  useSwitchChain    // <-- Ajouté
} from 'wagmi';
import { useFaucet } from '@/hooks/useFaucet';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Droplet, CheckCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectButton } from '@rainbow-me/rainbowkit'; 
import { parseUnits, formatUnits } from 'viem';

// --- ADRESSES ---
const VAULT_ADDRESS = '0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0';
const TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b'; 

// --- CIBLE RÉSEAU ---
const TARGET_CHAIN_ID = 688689; // <-- ID de ta chaîne cible

// --- ABIs ---
const VAULT_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "traderDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "traderWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "trader", "type": "address" }], "name": "getTraderTotalBalance", "outputs": [{ "internalType": "uint256", "name": "total6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "freeBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
] as const;

const ERC20_ABI = [
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
] as const;

export const WalletView = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId(); // <-- Récupère l'ID actuel
  const { switchChain } = useSwitchChain(); // <-- Fonction pour changer de réseau
  const { toast } = useToast();
  
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // --- LECTURE DES SOLDES (VAULT + WALLET) ---
  const safeAddress = address || '0x0000000000000000000000000000000000000000';

  const { data: chainData, refetch: refetchData } = useReadContracts({
    contracts: [
        { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getTraderTotalBalance', args: [safeAddress] },
        { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'freeBalance', args: [safeAddress] },
        { address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: [safeAddress] },
        { address: TOKEN_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: [safeAddress, VAULT_ADDRESS] }
    ],
    query: { enabled: !!address, refetchInterval: 3000 }
  });

  // Extraction et formatage
  const vaultTotalDisplay = chainData?.[0]?.status === 'success' ? Number(formatUnits(chainData[0].result as bigint, 6)) : 0;
  const vaultAvailableDisplay = chainData?.[1]?.status === 'success' ? Number(formatUnits(chainData[1].result as bigint, 6)) : 0;
  const vaultLockedDisplay = vaultTotalDisplay - vaultAvailableDisplay;
  
  const walletBalanceDisplay = chainData?.[2]?.status === 'success' ? Number(formatUnits(chainData[2].result as bigint, 6)) : 0;
  const tokenAllowance = chainData?.[3]?.status === 'success' ? (chainData[3].result as bigint) : 0n;

  // --- HOOK FAUCET ---
  const { hasClaimed, isClaiming, claimTestTokens } = useFaucet();

  // --- ÉTATS LOCAUX ---
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [isTransacting, setIsTransacting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Limites dynamiques
  const maxWithdraw = vaultAvailableDisplay;
  const maxDeposit = walletBalanceDisplay;

  const handleSetMax = () => {
    setAmount(mode === 'withdraw' ? maxWithdraw.toFixed(2) : maxDeposit.toFixed(2)); 
  };

  // --- LOGIQUE DE TRANSACTION ---
  const handleTransaction = async () => {
    // Sécurité supplémentaire : on ne fait rien si mauvais réseau
    if (chainId !== TARGET_CHAIN_ID) return;
    if (!amount || parseFloat(amount) <= 0) return;
    
    try {
      const amount6 = parseUnits(amount, 6);
      let hash;

      if (mode === 'deposit') {
        if (tokenAllowance < amount6) {
            setIsApproving(true);
            toast({ title: "Approval Required", description: "Please approve the token first." });
            
            const approveHash = await writeContractAsync({
                address: TOKEN_ADDRESS, 
                abi: ERC20_ABI, 
                functionName: 'approve', 
                args: [VAULT_ADDRESS, amount6], 
            });

            if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
            toast({ title: "Approved", description: "Token approved successfully." });
            setIsApproving(false);
        }

        setIsTransacting(true);
        hash = await writeContractAsync({
            address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'traderDeposit', args: [amount6],
        });
      } else {
        setIsTransacting(true);
        hash = await writeContractAsync({
            address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'traderWithdraw', args: [amount6],
        });
      }

      toast({ title: "Transaction Sent", description: "Waiting for confirmation..." });

      if (publicClient && hash) {
          await publicClient.waitForTransactionReceipt({ hash });
      }

      toast({ title: "Success", description: `${mode === 'deposit' ? 'Deposited' : 'Withdrawn'} ${amount} USDT` });
      setAmount('');
      setTimeout(() => refetchData(), 1000);

    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsTransacting(false);
      setIsApproving(false);
    }
  };

  const handleFaucetClaim = async () => {
      // Sécurité pour le faucet aussi
      if (chainId !== TARGET_CHAIN_ID) {
         switchChain({ chainId: TARGET_CHAIN_ID });
         return;
      }

      if (isClaiming) return;
      try {
          await claimTestTokens();
          toast({ title: "Tokens Claimed", description: "1,000 USDT added to your wallet." });
          setTimeout(() => refetchData(), 2000);
      } catch (e: any) {
          toast({ title: "Claim failed", description: e.message, variant: "destructive" });
      }
  };

  // --- RENDER : NOT CONNECTED ---
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6 bg-white dark:bg-black transition-colors">
        <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-zinc-800">
          <Wallet className="w-10 h-10 text-slate-400 dark:text-zinc-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white tracking-tight">Connect Wallet</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
            Connect your wallet to manage your funds, claim test tokens, and start trading.
          </p>
        </div>
        <div className="custom-connect-button-wrapper">
             <ConnectButton />
        </div>
      </div>
    );
  }

  // --- ÉTATS DES BOUTONS ---
  const needsApproval = mode === 'deposit' && amount && parseFloat(amount) > 0 && tokenAllowance < parseUnits(amount, 6);
  const buttonText = isApproving ? 'Approving...' : isTransacting ? 'Confirming...' : needsApproval ? 'Approve & Deposit' : mode === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdraw';
  const isWrongNetwork = chainId !== TARGET_CHAIN_ID;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black font-sans overflow-y-auto pb-24 transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      {/* BANNIÈRE MAUVAIS RÉSEAU */}
      {isWrongNetwork && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-500 text-[11px] py-2 px-4 font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
          <Info className="w-3.5 h-3.5" />
          Wrong Network: Switch to Chain {TARGET_CHAIN_ID}
        </div>
      )}

      {/* 1. BALANCE CARD (Vault) */}
      <div className="p-6 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-zinc-800/60 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Vault Equity</span>
        <div className="text-4xl font-mono font-bold text-slate-900 dark:text-white mb-6">
          ${vaultTotalDisplay.toFixed(2)}
        </div>
        
        {/* GRILLE PLEINE LARGEUR */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="p-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-zinc-800/60 rounded-md flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Available</span>
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">${vaultAvailableDisplay.toFixed(2)}</span>
          </div>
          <div className="p-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-zinc-800/60 rounded-md flex flex-col items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Locked</span>
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">${vaultLockedDisplay.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 2. ACTIONS (Deposit / Withdraw) */}
      <div className="p-4 flex-col">
        
        {/* Tabs */}
        <div className="flex bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] p-0.5 mb-5">
          <button
            onClick={() => setMode('deposit')}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2
              ${mode === 'deposit' 
                ? 'bg-white dark:bg-[#2A2A2A] text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Deposit
          </button>
          <button
            onClick={() => setMode('withdraw')}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-[2px] transition-colors flex items-center justify-center gap-2
              ${mode === 'withdraw' 
                ? 'bg-white dark:bg-[#2A2A2A] text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw
          </button>
        </div>

        {/* Info Wallet (Wallet Balance) */}
        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 p-3 rounded-md mb-5">
            <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">Wallet Balance</span>
            </div>
            <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-400">{walletBalanceDisplay.toFixed(2)} USDT</span>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500 px-1">
              <span>Amount (USDT)</span>
              <span>Max: {mode === 'withdraw' ? maxWithdraw.toFixed(2) : maxDeposit.toFixed(2)}</span>
            </div>
            
            <div className="relative flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-[4px] focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors h-14 px-3">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isWrongNetwork}
                className="flex-1 h-full bg-transparent border-none text-slate-900 dark:text-white text-lg font-mono focus-visible:ring-0 px-0 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
              />
              <button 
                onClick={handleSetMax}
                disabled={isWrongNetwork}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 disabled:opacity-50 px-3 py-1.5 rounded-[2px] transition-colors uppercase tracking-widest"
              >
                Max
              </button>
            </div>
          </div>

          {/* CHANGEMENT DYNAMIQUE DU BOUTON ICI */}
          {isWrongNetwork ? (
             <Button 
              onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
              className="w-full h-12 text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-none transition-transform active:scale-[0.98] rounded-[4px] uppercase tracking-wider"
             >
              Switch Network
             </Button>
          ) : (
             <Button 
               onClick={handleTransaction}
               disabled={isTransacting || isApproving || !amount || parseFloat(amount) <= 0 || (mode === 'deposit' && parseFloat(amount) > walletBalanceDisplay) || (mode === 'withdraw' && parseFloat(amount) > maxWithdraw)}
               className={`w-full h-12 text-sm font-bold shadow-none transition-transform active:scale-[0.98] rounded-[4px] uppercase tracking-wider
                 ${needsApproval ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black'}`}
             >
               {(isTransacting || isApproving) ? <Loader2 className="animate-spin w-4 h-4" /> : buttonText}
             </Button>
          )}
        </div>
      </div>

      {/* 3. FAUCET JOURNALIER (Bottom Section) */}
      <div className="p-4 mt-2">
          <div className="p-4 bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800/60 rounded-md">
            <div className="flex items-center gap-2 mb-2">
                <Droplet className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Faucet</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Need more test funds? You can claim 1,000 USDT every 24 hours.
            </p>
            
            <Button
                onClick={handleFaucetClaim}
                disabled={hasClaimed || isClaiming}
                variant="outline"
                className={`w-full text-xs font-bold transition-colors h-10 ${isWrongNetwork ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:border-red-900/50' : 'border-blue-200 dark:border-blue-900/50 bg-white dark:bg-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
            >
                {isWrongNetwork ? 'Switch Network to Claim' : isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : hasClaimed ? (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Already Claimed Today</>
                ) : (
                    'Claim 1,000 USDT'
                )}
            </Button>
          </div>
      </div>

    </div>
  );
};
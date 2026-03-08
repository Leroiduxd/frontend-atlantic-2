"use client";

import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useReadContracts, 
  usePublicClient,
  useChainId,
  useSwitchChain
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
const TARGET_CHAIN_ID = 688689; 

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

// Utilitaire pour formater joliment les nombres (ex: 1,000,000.00)
const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const WalletView = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId(); 
  const { switchChain } = useSwitchChain(); 
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

  const maxWithdraw = vaultAvailableDisplay;
  const maxDeposit = walletBalanceDisplay;

  const handleSetMax = () => {
    // On met le max sans les virgules pour l'input form
    setAmount(mode === 'withdraw' ? maxWithdraw.toFixed(2) : maxDeposit.toFixed(2)); 
  };

  // --- LOGIQUE DE TRANSACTION ---
  const handleTransaction = async () => {
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
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-white dark:bg-[#0a0a0a] transition-colors">
        <div className="w-20 h-20 bg-slate-100 dark:bg-[#111] rounded-full flex items-center justify-center border border-slate-200 dark:border-zinc-800 mb-6 shadow-sm">
          <Wallet className="w-10 h-10 text-slate-400 dark:text-zinc-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Connect Wallet</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">
          Connect your wallet to manage your funds, claim test tokens, and start trading.
        </p>
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
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a] font-sans overflow-y-auto pb-24 transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      {/* BANNIÈRE MAUVAIS RÉSEAU */}
      {isWrongNetwork && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-500 text-[11px] py-2.5 px-4 font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
          <Info className="w-4 h-4" />
          Wrong Network: Switch to Chain {TARGET_CHAIN_ID}
        </div>
      )}

      {/* HEADER ÉPURÉ */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            Wallet
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Manage your trading capital.</p>
      </div>

      {/* 1. BALANCE CARD */}
      <div className="mx-5 my-4 bg-white dark:bg-[#111] rounded-[20px] border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex-shrink-0">
        <div className="p-6 text-center border-b border-slate-100 dark:border-zinc-800/60">
            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Vault Equity</p>
            {/* CORRECTION DU TEXTE COUPÉ : ajout de leading-normal, py-1, text-3xl sur mobile, et truncate */}
            <div className="text-3xl sm:text-4xl font-mono font-bold text-slate-900 dark:text-white leading-normal py-1 px-2 w-full truncate">
                ${formatNumber(vaultTotalDisplay)}
            </div>
        </div>
        
        <div className="flex divide-x divide-slate-100 dark:divide-zinc-800/60 p-4">
          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
            <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1">Available</span>
            {/* TRUNCATE POUR LES GROS CHIFFRES */}
            <span className="font-mono text-sm font-medium text-slate-900 dark:text-white w-full text-center truncate">
              ${formatNumber(vaultAvailableDisplay)}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
            <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1">Locked</span>
            <span className="font-mono text-sm font-medium text-slate-900 dark:text-white w-full text-center truncate">
              ${formatNumber(vaultLockedDisplay)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ACTIONS (Deposit / Withdraw) */}
      <div className="px-5 flex-col">
        
        {/* TABS (Style Pill Toggle) */}
        <div className="flex bg-slate-100 dark:bg-[#1c1c1e] p-1 rounded-full mb-6 sticky top-0 z-10">
          <button
            onClick={() => setMode('deposit')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'deposit' 
                ? 'bg-white dark:bg-[#0a0a0a] shadow-sm text-slate-900 dark:text-white' 
                : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            <ArrowDownToLine className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => setMode('withdraw')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'withdraw' 
                ? 'bg-white dark:bg-[#0a0a0a] shadow-sm text-slate-900 dark:text-white' 
                : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            <ArrowUpFromLine className="w-4 h-4" /> Withdraw
          </button>
        </div>

        {/* Formulaire & Info Wallet */}
        <div className="space-y-4">
          
          <div className="flex justify-between items-center px-1 w-full overflow-hidden gap-2">
            <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 flex-shrink-0">
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-medium">Wallet Balance</span>
            </div>
            {/* TRUNCATE POUR EMPECHER LE DEBORDEMENT DES MILLIARDS */}
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">
                {formatNumber(walletBalanceDisplay)} USDT
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="relative flex items-center bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all h-14 px-4 shadow-sm">
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
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest"
              >
                Max
              </button>
            </div>
            <div className="text-[10px] font-medium text-right text-slate-400 dark:text-zinc-500 px-1 truncate mt-1">
              Available to {mode}: <span className="font-mono">{mode === 'withdraw' ? formatNumber(maxWithdraw) : formatNumber(maxDeposit)}</span>
            </div>
          </div>

          {isWrongNetwork ? (
             <Button 
              onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
              className="w-full h-12 text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-none rounded-xl uppercase tracking-wider transition-transform active:scale-[0.98]"
             >
              Switch Network
             </Button>
          ) : (
             <Button 
               onClick={handleTransaction}
               disabled={isTransacting || isApproving || !amount || parseFloat(amount) <= 0 || (mode === 'deposit' && parseFloat(amount) > walletBalanceDisplay) || (mode === 'withdraw' && parseFloat(amount) > maxWithdraw)}
               className={`w-full h-12 text-sm font-bold shadow-none transition-transform active:scale-[0.98] rounded-xl uppercase tracking-wider
                 ${needsApproval 
                    ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500' 
                 }`}
             >
               {(isTransacting || isApproving) ? <Loader2 className="animate-spin w-5 h-5" /> : buttonText}
             </Button>
          )}
        </div>
      </div>

      {/* 3. FAUCET JOURNALIER */}
      <div className="px-5 mt-8 pb-8 flex-shrink-0">
          <div className="bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-zinc-800/60 rounded-[20px] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <Droplet className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Faucet</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
                Need more test funds? You can claim 1,000 USDT every 24 hours.
            </p>
            
            <Button
                onClick={handleFaucetClaim}
                disabled={hasClaimed || isClaiming}
                className={`w-full text-xs font-bold rounded-xl transition-colors h-10 ${isWrongNetwork ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'}`}
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
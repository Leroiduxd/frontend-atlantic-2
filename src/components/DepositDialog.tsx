"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// On garde useVaultBalances pour le solde du Wallet (Metamask), mais on utilisera le contrat pour le Vault
import { useVaultBalances } from '@/hooks/useVaultBalances'; 
import { useToast } from '@/hooks/use-toast';
import { BanknoteArrowDown, BanknoteArrowUp, ArrowRight, Wallet } from 'lucide-react'; 
import { useAccount, useWriteContract, useReadContracts, usePublicClient } from 'wagmi'; 
import { parseUnits, formatUnits } from 'viem';

// --- CONSTANTES DU SMART CONTRACT ---
const VAULT_ADDRESS = '0xFebf0c9421f70041FbD3410ECE47D080f03fC7EE';
const VAULT_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }],
        "name": "traderDeposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }],
        "name": "traderWithdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "trader", "type": "address" }],
        "name": "getTraderTotalBalance",
        "outputs": [{ "internalType": "uint256", "name": "total6", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "name": "freeBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

type TransactionMode = 'deposit' | 'withdraw';

interface DepositDialogProps {
    className?: string;
}

export const DepositDialog = ({ className }: DepositDialogProps) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<TransactionMode>('deposit'); 
  
  // Hooks Wagmi
  const { address, isConnected, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  // On récupère le solde du Wallet via le hook existant (pour le max Deposit)
  const { walletBalance, refetchAll: refetchWallet } = useVaultBalances();

  // --- LECTURE DES DONNÉES DU VAULT (Total & Free) ---
  const { data: vaultData, refetch: refetchVaultData } = useReadContracts({
    contracts: [
        {
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'getTraderTotalBalance',
            args: address ? [address] : undefined,
        },
        {
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'freeBalance',
            args: address ? [address] : undefined,
        }
    ],
    query: {
        enabled: !!address,
        refetchInterval: 5000 // Rafraichissement auto toutes les 5s
    }
  });

  const rawTotalBalance = vaultData?.[0]?.result || 0n;
  const rawFreeBalance = vaultData?.[1]?.result || 0n;

  // Calculs des valeurs affichées (conversion depuis 6 décimales)
  const vaultTotalDisplay = Number(formatUnits(rawTotalBalance, 6));
  const vaultAvailableDisplay = Number(formatUnits(rawFreeBalance, 6));
  const vaultLockedDisplay = vaultTotalDisplay - vaultAvailableDisplay;

  // --- Display Data Mapping ---
  const simulatedWalletBalance = walletBalance; // String formatted
  const simulatedVaultBalance = vaultTotalDisplay; 
  const simulatedUsedMargin = vaultLockedDisplay;
  const simulatedAvailableBalance = vaultAvailableDisplay; 
  
  // --- Couleurs adaptatives ---
  const depositColor = 'text-trading-blue dark:text-zinc-600';
  const withdrawColor = 'text-red-500 dark:text-zinc-600'; 
  
  const currentDarkBgColor = mode === 'deposit' 
    ? 'bg-blue-100 dark:bg-zinc-900' 
    : 'bg-red-50 dark:bg-zinc-900'; 
    
  const currentActionColorClass = mode === 'deposit' ? 'bg-trading-blue hover:bg-trading-blue/90' : 'bg-trading-red hover:bg-trading-red/90';
  const CurrentMainIconColor = mode === 'deposit' ? depositColor : withdrawColor;

  const numericWalletBalance = useMemo(() => parseFloat(walletBalance.replace(/,/g, '')) || 0, [walletBalance]);
  const numericAvailableBalance = useMemo(() => simulatedAvailableBalance, [simulatedAvailableBalance]);

  const maxAmount = useMemo(() => {
    return mode === 'deposit' ? numericWalletBalance : numericAvailableBalance;
  }, [mode, numericWalletBalance, numericAvailableBalance]);

  const defaultInputValue = useMemo(() => {
    if (mode === 'deposit') {
        return walletBalance; 
    }
    return simulatedAvailableBalance.toFixed(2); 
  }, [mode, walletBalance, simulatedAvailableBalance]);

  useEffect(() => {
    if (open && isConnected) {
        setAmount(defaultInputValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, defaultInputValue, isConnected]);

  const MainActionIcon = ({ Icon, color }: { Icon: React.ElementType, color: string }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 -left-[25%] flex items-center justify-center h-full w-full`}>
      <Icon className={`w-[650px] h-[650px] ${color} opacity-30 z-0`} /> 
    </div>
  );

  const showConnectWalletToast = useCallback(() => {
    toast({ 
        title: "Connection Required", 
        description: "Please connect your wallet to proceed.", 
        variant: "destructive" 
    });
  }, [toast]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setAmount('');
      return;
    }
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return;

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
      // Conversion montant en BigInt avec 6 décimales
      const amount6 = parseUnits(amount, 6);

      let hash;
      if (mode === 'deposit') {
        // NOTE: Pour un vrai dépôt, il faut souvent un approve() sur le token ERC20 avant.
        // Ici on exécute strictement traderDeposit comme demandé.
        hash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'traderDeposit',
            args: [amount6],
        });
      } else {
        hash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'traderWithdraw',
            args: [amount6],
        });
      }

      toast({ title: 'Transaction Sent', description: 'Waiting for confirmation...' });

      if (publicClient && hash) {
          await publicClient.waitForTransactionReceipt({ hash });
      }

      toast({ title: `${mode} successful`, description: `${mode}ed $${amount}` });
      setAmount(defaultInputValue); 
      setOpen(false);
      
      // Mise à jour des balances
      setTimeout(() => {
        refetchWallet();
        refetchVaultData();
      }, 1000); 

    } catch (error: any) {
      console.error(error);
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
        <Button 
            variant="secondary" 
            size="sm" 
            className={`text-xs font-semibold ${className}`}
        >
          Deposit
        </Button>
      </DialogTrigger>
      
      <DialogContent className={`w-[650px] max-w-none p-0 shadow-xl rounded-lg min-h-[450px] overflow-hidden bg-white dark:bg-zinc-950 dark:border-zinc-800`}>
        
        {!isConnected ? (
             <div className="text-center py-12 px-8 flex flex-col items-center justify-center min-h-[450px]">
                <Wallet className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Wallet Connection Required</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Please connect your wallet to deposit or withdraw funds.
                </p>
                <div className="mx-auto w-fit">
                   <Button 
                    onClick={showConnectWalletToast}
                    className="bg-trading-blue hover:bg-trading-blue/90 dark:text-white"
                   >
                    Connect Wallet
                   </Button> 
                </div>
            </div>
        ) : (
        <>
            <div className="absolute top-4 right-4 z-20 flex space-x-2">
                <Button
                  onClick={() => setMode('deposit')}
                  className={`text-sm h-7 px-3 ${mode === 'deposit' 
                    ? 'bg-trading-blue hover:bg-trading-blue/80 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'}`}
                  size="sm"
                >
                  Deposit
                </Button>
                <Button
                  onClick={() => setMode('withdraw')}
                  className={`text-sm h-7 px-3 ${mode === 'withdraw' 
                    ? 'bg-trading-red hover:bg-trading-red/80 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'}`}
                  size="sm"
                >
                  Withdraw
                </Button>
            </div>


            <div className="relative flex h-full min-h-[450px]">
              
              <div className={`w-[42%] p-8 relative ${currentDarkBgColor}`}>
                <MainActionIcon Icon={CurrentIconComponent} color={CurrentMainIconColor} />
                <div className="relative z-10 text-base font-mono text-gray-800 dark:text-gray-200 space-y-2 mt-auto">
                </div>
              </div>

              <div className="w-[58%] p-8 flex flex-col justify-between items-end space-y-8 bg-white dark:bg-zinc-950">
                
                <div className="w-full text-xs font-mono text-gray-800 dark:text-gray-300 space-y-1 pt-8">
                    <p className="flex justify-between items-center">
                        Wallet Balance: <span className="font-semibold text-foreground dark:text-white">${simulatedWalletBalance}</span>
                    </p>
                    <p className="flex justify-between items-center">
                        Total Vault Balance: <span className="font-semibold text-foreground dark:text-white">${simulatedVaultBalance.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between items-center">
                        Used Margin: <span className="font-semibold text-foreground dark:text-white">${simulatedUsedMargin.toFixed(2)}</span>
                    </p>
                    
                    <p className={`flex justify-between items-center pt-2 text-sm font-bold ${CurrentMainIconColor}`}>
                        Available Balance: <span>${simulatedAvailableBalance.toFixed(2)}</span>
                    </p>
                </div>
                
                <div className="w-full space-y-4 mt-auto">
                    <h2 className="text-xl font-semibold w-full text-gray-800 dark:text-gray-100 text-right">
                        {currentActionLabel} Amount
                    </h2>

                    <div className="w-full flex space-x-0 items-center">
                        
                        <Input
                            type="number"
                            value={amount}
                            onChange={handleAmountChange} 
                            className="flex-grow h-10 text-base text-right bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 dark:text-white font-mono rounded-r-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            step="0.01"
                            placeholder="0.00"
                        />
                        
                        <Button
                            onClick={handleTransaction}
                            disabled={loading || !amount}
                            className={`h-10 px-4 text-base font-semibold ${currentActionColorClass} flex items-center rounded-l-none text-white`}
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
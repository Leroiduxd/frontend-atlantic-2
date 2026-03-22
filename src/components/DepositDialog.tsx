"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVaultBalances } from '@/hooks/useVaultBalances'; 
import { useFaucet } from '@/hooks/useFaucet'; 
import { useToast } from '@/hooks/use-toast';
import { BanknoteArrowDown, BanknoteArrowUp, ArrowRight, Wallet, Droplet, ShieldCheck } from 'lucide-react'; 
import { useAccount, useWriteContract, useReadContracts, usePublicClient } from 'wagmi'; 
import { parseUnits, formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// --- IMPORT DES CONSTANTES CENTRALISÉES ---
// Assure-toi que le chemin correspond bien à ton alias ou utilise un chemin relatif comme '../constants/addresses'
import { 
    VAULT_ADDRESS, 
    USDC_ADDRESS, 
    VAULT_ABI, 
    ERC20_ABI 
} from '@/constants/addresses';

type TransactionMode = 'deposit' | 'withdraw';
type Step = 'faucet' | 'approve' | 'trade';

interface DepositDialogProps {
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const DepositDialog = ({ className, open: controlledOpen, onOpenChange: controlledOnOpenChange }: DepositDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = typeof controlledOpen !== 'undefined';
  const open = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = (newOpen: boolean) => {
      if (!isControlled) setInternalOpen(newOpen);
      if (controlledOnOpenChange) controlledOnOpenChange(newOpen);
  };

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<TransactionMode>('deposit'); 
  
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const { walletBalance, refetchAll: refetchWallet } = useVaultBalances();
  const { hasClaimed, claimTestTokens, isClaiming } = useFaucet();

  const { data: vaultData, refetch: refetchVaultData } = useReadContracts({
    contracts: [
        { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getTraderTotalBalance', args: address ? [address] : undefined },
        { address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'freeBalance', args: address ? [address] : undefined },
        { address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, VAULT_ADDRESS] : undefined } // Remplacé TOKEN_ADDRESS par USDC_ADDRESS
    ],
    query: { enabled: !!address, refetchInterval: 5000 }
  });

  const rawTotalBalance = vaultData?.[0]?.result || 0n;
  const rawFreeBalance = vaultData?.[1]?.result || 0n;
  const currentAllowance = vaultData?.[2]?.result || 0n;

  const vaultTotalDisplay = Number(formatUnits(rawTotalBalance, 6));
  const vaultAvailableDisplay = Number(formatUnits(rawFreeBalance, 6));
  const vaultLockedDisplay = vaultTotalDisplay - vaultAvailableDisplay;
  const numericWalletBalance = parseFloat(walletBalance.replace(/,/g, '')) || 0;
  const allowanceDisplay = Number(formatUnits(currentAllowance, 6));

  const currentStep = useMemo<Step>(() => {
    if (!isConnected) return 'trade'; 
    if (!hasClaimed) return 'faucet';

    const hasDeposited = rawTotalBalance > 0n;
    const hasEnoughAllowance = allowanceDisplay >= 10000;
    const coversWalletBalance = numericWalletBalance > 0 && allowanceDisplay >= numericWalletBalance;

    if (hasDeposited || hasEnoughAllowance || coversWalletBalance) {
        return 'trade';
    }
    return 'approve';
  }, [isConnected, hasClaimed, rawTotalBalance, allowanceDisplay, numericWalletBalance]);

  const depositColor = 'text-trading-blue dark:text-zinc-600';
  const withdrawColor = 'text-red-500 dark:text-zinc-600'; 
  
  let currentDarkBgColor = 'bg-blue-100 dark:bg-zinc-900';
  let CurrentMainIconColor = depositColor;
  let CurrentIconComponent = BanknoteArrowDown;
  let currentActionColorClass = 'bg-trading-blue hover:bg-trading-blue/90';

  if (currentStep === 'trade' && mode === 'withdraw') {
      currentDarkBgColor = 'bg-red-50 dark:bg-zinc-900';
      CurrentMainIconColor = withdrawColor;
      CurrentIconComponent = BanknoteArrowUp;
      currentActionColorClass = 'bg-trading-red hover:bg-trading-red/90';
  } else if (currentStep === 'faucet') {
      CurrentIconComponent = Droplet;
  } else if (currentStep === 'approve') {
      CurrentIconComponent = ShieldCheck;
  }

  const maxAmount = mode === 'deposit' ? numericWalletBalance : vaultAvailableDisplay;
  const defaultInputValue = mode === 'deposit' ? walletBalance : vaultAvailableDisplay.toFixed(2); 

  useEffect(() => {
    if (open && isConnected && currentStep === 'trade') {
        setAmount(defaultInputValue);
    }
  }, [mode, open, defaultInputValue, isConnected, currentStep]);

  const MainActionIcon = ({ Icon, color }: { Icon: React.ElementType, color: string }) => (
    <div className={`absolute top-1/2 -translate-y-1/2 -left-[25%] flex items-center justify-center h-full w-full`}>
      <Icon className={`w-[650px] h-[650px] ${color} opacity-30 z-0`} /> 
    </div>
  );

  const showConnectWalletToast = useCallback(() => {
    toast({ title: "Connection Required", description: "Please connect your wallet to proceed.", variant: "destructive" });
  }, [toast]);

  const executeApproval = async (targetAmount: number) => {
    if (!isConnected) return showConnectWalletToast();
    setLoading(true);
    try {
        const amount6 = parseUnits(targetAmount.toString(), 6);
        const hash = await writeContractAsync({
            address: USDC_ADDRESS, // Remplacé TOKEN_ADDRESS par USDC_ADDRESS
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_ADDRESS, amount6],
        });
        toast({ title: 'Approval Sent', description: 'Waiting for confirmation...' });
        if (publicClient && hash) await publicClient.waitForTransactionReceipt({ hash });
        
        toast({ title: 'Success', description: `Vault approved for $${targetAmount}.` });
        refetchVaultData();
    } catch (error: any) {
        toast({ title: 'Failed', description: error?.message || 'Transaction failed', variant: 'destructive' });
    } finally {
        setLoading(false);
    }
  };

  const handleFaucetClaim = async () => {
    setLoading(true);
    try {
        await claimTestTokens();
        toast({ title: "Claim Successful", description: "Test funds claimed!" });
    } catch (error: any) {
        toast({ title: "Claim Failed", description: error?.message || "Transaction failed.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const handleTransaction = async () => {
    if (!isConnected) return showConnectWalletToast();
    const numericAmount = Number(amount);

    if (!amount || numericAmount <= 0) {
      return toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
    }
    if (numericAmount > maxAmount) {
        setLoading(false);
        return toast({ title: 'Insufficient Funds', description: `You cannot ${mode} more than your available balance.`, variant: 'destructive' });
    }

    setLoading(true);
    try {
      const amount6 = parseUnits(amount, 6);
      const funcName = mode === 'deposit' ? 'traderDeposit' : 'traderWithdraw';
      
      const hash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: funcName,
          args: [amount6],
      });

      toast({ title: 'Transaction Sent', description: 'Waiting for confirmation...' });
      if (publicClient && hash) await publicClient.waitForTransactionReceipt({ hash });

      toast({ title: `${mode} successful`, description: `${mode}ed $${amount}` });
      setAmount(defaultInputValue); 
      setOpen(false);
      
      setTimeout(() => { refetchWallet(); refetchVaultData(); }, 1000); 
    } catch (error: any) {
      toast({ title: `${mode} failed`, description: error?.message || 'Transaction failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      
      {!isControlled && (
          <DialogTrigger asChild>
            <Button 
                variant="secondary" 
                size="sm" 
                className={`text-xs font-semibold ${className}`}
                onClick={(e) => e.stopPropagation()} 
            >
              Deposit
            </Button>
          </DialogTrigger>
      )}
      
      <DialogContent 
        onClick={(e) => e.stopPropagation()} 
        className={`w-[650px] max-w-none p-0 shadow-xl rounded-lg min-h-[450px] overflow-hidden bg-white dark:bg-zinc-950 dark:border-zinc-800`}
      >
        {!isConnected ? (
             <div className="text-center py-12 px-8 flex flex-col items-center justify-center min-h-[450px]">
                <Wallet className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Wallet Connection Required</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Please connect your wallet to deposit or withdraw funds.</p>
                <div className="mx-auto w-fit">
                   <ConnectButton.Custom>
                       {({ openConnectModal }) => (
                           <Button 
                               onClick={openConnectModal} 
                               className="bg-trading-blue hover:bg-trading-blue/90 dark:text-white"
                           >
                               Connect Wallet
                           </Button>
                       )}
                   </ConnectButton.Custom>
                </div>
            </div>
        ) : (
        <>
            {currentStep === 'trade' && (
                <div className="absolute top-4 right-4 z-20 flex space-x-2">
                    <Button
                    onClick={() => setMode('deposit')}
                    className={`text-sm h-7 px-3 ${mode === 'deposit' ? 'bg-trading-blue hover:bg-trading-blue/80 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'}`}
                    size="sm"
                    >
                    Deposit
                    </Button>
                    <Button
                    onClick={() => setMode('withdraw')}
                    className={`text-sm h-7 px-3 ${mode === 'withdraw' ? 'bg-trading-red hover:bg-trading-red/80 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'}`}
                    size="sm"
                    >
                    Withdraw
                    </Button>
                </div>
            )}

            <div className="relative flex h-full min-h-[450px]">
              
              <div className={`w-[42%] p-8 relative ${currentDarkBgColor}`}>
                <MainActionIcon Icon={CurrentIconComponent} color={CurrentMainIconColor} />
              </div>

              <div className="w-[58%] p-8 flex flex-col justify-between items-end space-y-8 bg-white dark:bg-zinc-950">
                
                {currentStep === 'trade' && (
                    <div className="w-full text-xs font-mono text-gray-800 dark:text-gray-300 space-y-1 pt-8">
                        <p className="flex justify-between items-center">
                            Wallet Balance: <span className="font-semibold text-foreground dark:text-white">${numericWalletBalance.toFixed(2)}</span>
                        </p>
                        <p className="flex justify-between items-center">
                            Total Vault Balance: <span className="font-semibold text-foreground dark:text-white">${vaultTotalDisplay.toFixed(2)}</span>
                        </p>
                        <p className="flex justify-between items-center">
                            Used Margin: <span className="font-semibold text-foreground dark:text-white">${vaultLockedDisplay.toFixed(2)}</span>
                        </p>
                        <p className={`flex justify-between items-center pt-2 text-sm font-bold ${CurrentMainIconColor}`}>
                            Available Balance: <span>${vaultAvailableDisplay.toFixed(2)}</span>
                        </p>
                    </div>
                )}

                {(currentStep === 'faucet' || currentStep === 'approve') && (
                    <div className="w-full text-left pt-8 space-y-2">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {currentStep === 'faucet' ? 'Step 1: Claim Tokens' : 'Step 2: Approve Vault'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            {currentStep === 'faucet' 
                                ? "You need test tokens to start trading. Claim them now from our faucet." 
                                : "To allow the Vault to process your deposits securely, you need to approve the smart contract."}
                        </p>
                    </div>
                )}
                
                <div className="w-full space-y-4 mt-auto">
                    
                    {currentStep === 'faucet' && (
                        <Button
                            onClick={handleFaucetClaim}
                            disabled={loading || isClaiming}
                            className="w-full h-10 px-4 text-base font-semibold bg-trading-blue hover:bg-trading-blue/90 text-white"
                        >
                            {loading || isClaiming ? 'Claiming...' : 'Claim Faucet'}
                        </Button>
                    )}

                    {currentStep === 'approve' && (
                        <Button
                            onClick={() => executeApproval(10000)}
                            disabled={loading}
                            className="w-full h-10 px-4 text-base font-semibold bg-trading-blue hover:bg-trading-blue/90 text-white"
                        >
                            {loading ? 'Approving...' : 'Approve $10,000'}
                        </Button>
                    )}

                    {currentStep === 'trade' && (
                        <>
                            <h2 className="text-xl font-semibold w-full text-gray-800 dark:text-gray-100 text-right">
                                {mode === 'deposit' ? 'Deposit' : 'Withdraw'} Amount
                            </h2>
                            <div className="w-full flex space-x-0 items-center">
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        if (!isNaN(val) && val > maxAmount) setAmount(maxAmount.toFixed(2));
                                        else setAmount(e.target.value);
                                    }} 
                                    className="flex-grow h-10 text-base text-right bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 dark:text-white font-mono rounded-r-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                                
                                <Button
                                    onClick={handleTransaction}
                                    disabled={loading || !amount}
                                    className={`h-10 px-4 text-base font-semibold ${currentActionColorClass} flex items-center rounded-l-none text-white`}
                                >
                                    {loading ? '...' : <>{mode === 'deposit' ? 'Deposit' : 'Withdraw'} <ArrowRight className="w-4 h-4 ml-2" /></>}
                                </Button>
                            </div>

                            {mode === 'deposit' && (
                                <div className="w-full flex justify-end gap-3 pt-1">
                                    <button 
                                        onClick={() => executeApproval(10000)}
                                        className="text-[10px] text-gray-400 hover:text-trading-blue transition-colors cursor-pointer"
                                    >
                                        Approve more ($10k)
                                    </button>
                                    <button 
                                        onClick={() => executeApproval(0)}
                                        className="text-[10px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                    >
                                        Revoke approval
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                </div>
              </div>
            </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};
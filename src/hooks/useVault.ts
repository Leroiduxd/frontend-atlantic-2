import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';
import { VAULT_ADDRESS, VAULT_ABI, TOKEN_ADDRESS, TOKEN_ABI } from '@/config/contracts';
import { formatUnits, parseUnits } from 'viem';
import { customChain } from '@/config/wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';

export const useVault = () => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  // Read vault balances
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const { data: available, refetch: refetchAvailable } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'available',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const { data: locked, refetch: refetchLocked } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'locked',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

    // Read token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, VAULT_ADDRESS] : undefined,
    chainId: customChain.id, // Explicitly specify the destination chain
    query: {
      enabled: !!address,
    },
  });

  // Read token balance
  const { data: tokenBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  // Format values (6 decimals)
  const formattedBalance = balance ? Number(formatUnits(balance, 6)).toFixed(2) : '0.00';
  const formattedAvailable = available ? Number(formatUnits(available, 6)).toFixed(2) : '0.00';
  const formattedLocked = locked ? Number(formatUnits(locked, 6)).toFixed(2) : '0.00';
  const formattedTokenBalance = tokenBalance ? Number(formatUnits(tokenBalance, 6)).toFixed(2) : '0.00';

  // Approve token
  const approveToken = async (amount: string) => {
    if (!address) throw new Error('No wallet connected');
    
    const amountInWei = parseUnits(amount, 6);
    
    try {
      const hash = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [VAULT_ADDRESS, amountInWei],
        account: address,
        chain: customChain,
      });

      return hash;
    } catch (error: unknown) {
      console.error('Approval error details:', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  // Deposit
  const deposit = async (amount: string) => {
    if (!address) throw new Error('No wallet connected');

    if (!amount || amount.trim() === '') {
      throw new Error('Amount cannot be empty');
    }
    
    const normalizedAmount = amount.trim();
    const numericAmount = parseFloat(normalizedAmount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}. Must be a positive number.`);
    }
    
    let amountInWei: bigint;
    try {
      amountInWei = parseUnits(normalizedAmount, 6);
      
      if (amountInWei === 0n) {
        throw new Error(`Amount parsed to zero. Original: ${amount}, Normalized: ${normalizedAmount}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse amount: ${amount}. ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Refetch allowance to ensure we have the latest value from the correct chain
    // The hook already has chainId: customChain.id, but we refetch to get fresh data
    const { data: currentAllowance } = await refetchAllowance();
    const allowanceValue = currentAllowance || allowance || 0n;
    
    // Check allowance
    if (!allowanceValue || allowanceValue < amountInWei) {
      const approvalHash = await approveToken(amount);
      
      // Wait for approval transaction to be confirmed
      await waitForTransactionReceipt(config, {
        hash: approvalHash,
        confirmations: 1,
      });
      
      // Wait a bit for state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refetch allowance after approval
      await refetchAllowance();
    }

    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amountInWei],
        account: address,
        chain: customChain,
      });

      return hash;
    } catch (error: unknown) {
      console.error('Deposit error details:', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  // Withdraw
  const withdraw = async (amount: string) => {
    if (!address) throw new Error('No wallet connected');

    const amountInWei = parseUnits(amount, 6);

    try {
      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [amountInWei],
        account: address,
        chain: customChain,
      });

      return hash;
    } catch (error: unknown) {
      console.error('Withdraw error details:', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const refetchAll = () => {
    refetchBalance();
    refetchAvailable();
    refetchLocked();
    refetchAllowance();
  };

  return {
    balance: formattedBalance,
    available: formattedAvailable,
    locked: formattedLocked,
    tokenBalance: formattedTokenBalance,
    deposit,
    withdraw,
    approveToken,
    refetchAll,
  };
};

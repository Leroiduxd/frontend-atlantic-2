import { useState, useCallback, useMemo } from 'react';
import { 
    useAccount, 
    useReadContract, 
    useSimulateContract, 
    useWriteContract, 
    useBalance,
    usePublicClient
} from 'wagmi';
import { parseUnits, maxUint256 } from 'viem'; 
import { useQueryClient } from '@tanstack/react-query';

// --- Importation des Constantes Centralisées ---
// Note : Modifie le chemin '../constants/addresses' selon ton arborescence
import {
  FAUCET_ADDRESS,
  USDC_ADDRESS,
  VAULT_ADDRESS,
  FAUCET_ABI,
  ERC20_ABI
} from '../constants/addresses';

// Constante pour le délai de re-fetch et le seuil d'approbation
const REFETCH_DELAY_MS = 5000;
const SUFFICIENT_APPROVAL_THRESHOLD = parseUnits('10000', 6); 

export const useFaucet = () => {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  // --- Helpers ---
  const refetch = useCallback(() => {
    if (!queryClient || !address) return;
    queryClient.invalidateQueries();
  }, [queryClient, address]);

  const readQueryOptions = useMemo(() => ({
    enabled: isConnected && !!address,
    staleTime: 5000, 
    pollingInterval: 10000, 
  }), [isConnected, address]);

  // --- Lecture des données (Statut, Prochaine éligibilité, Solde, Approbation) ---

  // 1. hasClaimed
  const { data: hasClaimedData, isLoading: isLoadingClaimStatus } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'hasClaimed',
    args: [address as `0x${string}`],
    query: readQueryOptions,
  });
  const hasClaimed = hasClaimedData ?? false;

  // 1b. nextEligibleAt
  const { data: nextEligibleAtData } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'nextEligibleAt',
    args: [address as `0x${string}`],
    query: readQueryOptions,
  });
  const nextEligibleAt = nextEligibleAtData ? Number(nextEligibleAtData) : null;
  
  // 2. Token Balance (Utilisation de USDC_ADDRESS)
  const { data: balanceData } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    query: {
        enabled: isConnected && !!address,
        staleTime: readQueryOptions.staleTime,
        pollingInterval: readQueryOptions.pollingInterval,
    }
  });
  const tokenBalance = useMemo(() => parseFloat(balanceData?.formatted || '0'), [balanceData]);

  // 3. Token Allowance (Utilisation de USDC_ADDRESS)
  const { data: allowanceData } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, VAULT_ADDRESS],
    query: readQueryOptions,
  });
  
  const isApproved = useMemo(() => {
    if (!allowanceData) return false;
    return allowanceData >= SUFFICIENT_APPROVAL_THRESHOLD;
  }, [allowanceData]);

  // --- Logique d'Écriture : CLAIM ---
  const { data: claimSimulate } = useSimulateContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'claim',
    account: address,
    query: {
        enabled: isConnected && !hasClaimed,
    }
  });
  
  const [isClaiming, setIsClaiming] = useState(false);

  const claimTestTokens = useCallback(async () => {
    if (!claimSimulate?.request) {
        throw new Error("Claim is not possible (already claimed or simulation failed).");
    }
    
    setIsClaiming(true);
    try {
        const hash = await writeContractAsync(claimSimulate.request);
        
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        
        // Délai de 5 secondes après confirmation pour le re-fetch
        await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY_MS));
        
        refetch(); 
    } finally {
        setIsClaiming(false);
    }
  }, [claimSimulate?.request, writeContractAsync, refetch, publicClient]);

  // --- Logique d'Écriture : APPROVE (Infinie) ---
  const infiniteApprovalAmount = maxUint256; 

  // Utilisation de USDC_ADDRESS
  const { data: approveSimulate } = useSimulateContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [VAULT_ADDRESS, infiniteApprovalAmount],
    account: address,
    query: {
        enabled: isConnected && !isApproved,
    }
  });

  const [isApproving, setIsApproving] = useState(false);

  const approveVault = useCallback(async () => {
    if (!approveSimulate?.request) {
        throw new Error("Approval is not possible (already approved or simulation failed).");
    }
    
    setIsApproving(true);
    try {
        const hash = await writeContractAsync(approveSimulate.request);
        
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        // Délai de 5 secondes après confirmation pour le re-fetch
        await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY_MS));
        
        refetch(); 
    } finally {
        setIsApproving(false);
    }
  }, [approveSimulate?.request, writeContractAsync, refetch, publicClient]);

  return {
    hasClaimed,
    nextEligibleAt,
    isLoadingClaimStatus,
    isClaiming,
    claimTestTokens,
    tokenBalance,
    isApproved,
    isApproving,
    approveVault,
    refetch,
  };
};
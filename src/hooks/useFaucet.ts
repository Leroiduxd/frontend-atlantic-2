import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    useAccount, 
    useReadContract, 
    useSimulateContract, 
    useWriteContract, 
    useWaitForTransactionReceipt, 
    useBalance,
    useConfig
} from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem'; 

// --- ADRESSES ET ABIs ---
const FAUCET_ADDRESS = '0x68c8eb31fbf00d4d37904ad76d68e78763429700';
const ERC20_TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b';
const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11';

// ABI du Faucet
const FAUCET_ABI = [
  { "inputs": [], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "address", "name": "", "type": "address" } ], "name": "hasClaimed", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" },
] as const;

// ABI de l'ERC20
const ERC20_ABI = [
  { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" },
] as const;

// Constante pour le délai de re-fetch et le seuil d'approbation
const REFETCH_DELAY_MS = 5000;
const SUFFICIENT_APPROVAL_THRESHOLD = parseUnits('10000', 6); // 10,000 unités TUSD * 10^6 (si 6 décimales)


export const useFaucet = () => {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  // --- Helpers ---
  const refetch = useCallback(() => {
    if (!config || !address) return;
    // Invalider toutes les requêtes pour forcer le re-fetch des données lues
    config.queryClient.invalidateQueries();
  }, [config, address]);

  const readQueryOptions = useMemo(() => ({
    enabled: isConnected && !!address,
    staleTime: 5000, 
    pollingInterval: 10000, 
  }), [isConnected, address]);

  // --- Lecture des données (Statut, Solde, Approbation) ---

  // 1. hasClaimed
  const { data: hasClaimedData, isLoading: isLoadingClaimStatus } = useReadContract({
    address: FAUCET_ADDRESS,
    abi: FAUCET_ABI,
    functionName: 'hasClaimed',
    args: [address as `0x${string}`],
    query: readQueryOptions,
  });
  const hasClaimed = hasClaimedData ?? false;
  
  // 2. Token Balance
  const { data: balanceData } = useBalance({
    address: address,
    token: ERC20_TOKEN_ADDRESS,
    query: {
        enabled: isConnected && !!address,
        staleTime: readQueryOptions.staleTime,
        pollingInterval: readQueryOptions.pollingInterval,
    }
  });
  const tokenBalance = useMemo(() => parseFloat(balanceData?.formatted || '0'), [balanceData]);

  // 3. Token Allowance
  const { data: allowanceData } = useReadContract({
    address: ERC20_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, VAULT_ADDRESS as `0x${string}`],
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
        
        await config.publicClient.waitForTransactionReceipt({ hash });
        
        // Délai de 5 secondes après confirmation pour le re-fetch
        await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY_MS));
        
        refetch(); 
    } finally {
        setIsClaiming(false);
    }
  }, [claimSimulate?.request, writeContractAsync, refetch, config.publicClient]);


  // --- Logique d'Écriture : APPROVE (Infinie) ---
  const infiniteApprovalAmount = maxUint256; 

  const { data: approveSimulate } = useSimulateContract({
    address: ERC20_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [VAULT_ADDRESS as `0x${string}`, infiniteApprovalAmount],
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
        
        await config.publicClient.waitForTransactionReceipt({ hash });

        // Délai de 5 secondes après confirmation pour le re-fetch
        await new Promise(resolve => setTimeout(resolve, REFETCH_DELAY_MS));
        
        refetch(); 
    } finally {
        setIsApproving(false);
    }
  }, [approveSimulate?.request, writeContractAsync, refetch, config.publicClient, isApproved]);


  return {
    hasClaimed,
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
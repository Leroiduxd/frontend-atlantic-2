import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useBalance } from 'wagmi';
import { formatUnits } from 'viem'; 

// --- ADRESSES ET ABIs ---
const ERC20_TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b';
const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11';
const TOKEN_DECIMALS = 6; // Le token TUSD a 6 décimales

// ABI minimal pour les soldes du Vault
const VAULT_ABI = [
    // balance(address user)
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    // locked(address user)
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "locked", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    // available(address user)
    { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "available", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
] as const;

export const useVaultBalances = () => {
    const { address, isConnected } = useAccount();
    const [refetchIndex, setRefetchIndex] = useState(0);

    const queryOptions = useMemo(() => ({
        enabled: isConnected && !!address,
        watch: true as const, // Re-fetch auto
        staleTime: 5000,
        scopeKey: `vault-balances-${address}-${refetchIndex}`,
    }), [isConnected, address, refetchIndex]);

    // 1. Solde du Wallet (TUSD)
    const { data: walletBalanceData } = useBalance({
        address: address,
        token: ERC20_TOKEN_ADDRESS,
        query: queryOptions,
    });
    const walletBalance = useMemo(() => walletBalanceData?.formatted || '0.00', [walletBalanceData]);

    // 2. Total Balance dans le Vault
    const { data: totalBalanceRaw } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'balance',
        args: [address as `0x${string}`],
        query: queryOptions,
    });
    const totalBalance = useMemo(() => {
        if (!totalBalanceRaw) return 0;
        return parseFloat(formatUnits(totalBalanceRaw, TOKEN_DECIMALS));
    }, [totalBalanceRaw]);

    // 3. Locked Margin dans le Vault
    const { data: lockedMarginRaw } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'locked',
        args: [address as `0x${string}`],
        query: queryOptions,
    });
    const lockedMargin = useMemo(() => {
        if (!lockedMarginRaw) return 0;
        return parseFloat(formatUnits(lockedMarginRaw, TOKEN_DECIMALS));
    }, [lockedMarginRaw]);

    // 4. Available Balance dans le Vault
    const { data: availableBalanceRaw } = useReadContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'available',
        args: [address as `0x${string}`],
        query: queryOptions,
    });
    const availableBalance = useMemo(() => {
        if (!availableBalanceRaw) return 0;
        return parseFloat(formatUnits(availableBalanceRaw, TOKEN_DECIMALS));
    }, [availableBalanceRaw]);

    const refetchAll = useCallback(() => {
        setRefetchIndex(prev => prev + 1);
    }, []);

    return {
        walletBalance,
        totalBalance,
        lockedMargin,
        availableBalance,
        refetchAll,
    };
};
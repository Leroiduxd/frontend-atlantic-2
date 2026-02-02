"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  usePublicClient,
  useReadContract,
  useBalance
} from 'wagmi';
import { formatUnits, parseUnits, isAddress } from 'viem';
import { ArrowDownToLine, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// --- CONFIGURATION & ABI (Identique au Desktop) ---
const VAULT_ADDRESS = "0x90bE27e7e7a5D129F43e3D461bf70241DBaee737";
const USDC_ADDRESS = "0x0000000000000000000000000000000000000000"; 

const VAULT_ABI = [
  // READS
  { "inputs": [], "name": "currentEpoch", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "lpTokenPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getLpTotalCapital6", "outputs": [{ "internalType": "uint256", "name": "total6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "name": "pendingDepositOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "computeLpShares", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }, { "internalType": "uint256", "name": "pendingCurrentEpoch6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  
  // LISTS
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getLpEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getLpEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "e", "type": "uint256" }], "name": "getLpSharesForEpoch", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  
  // WITHDRAW READS
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getWithdrawEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getWithdrawEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "userWithdraws", "outputs": [{ "internalType": "uint256", "name": "sharesRequested18", "type": "uint256" }, { "internalType": "uint256", "name": "usdWithdrawn6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "withdrawBuckets", "outputs": [{ "internalType": "uint256", "name": "totalSharesInitial18", "type": "uint256" }, { "internalType": "uint256", "name": "sharesRemaining18", "type": "uint256" }, { "internalType": "uint256", "name": "totalUsdAllocated6", "type": "uint256" }], "stateMutability": "view", "type": "function" },

  // WRITES
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "requestLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "reduceLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256[]", "name": "depositEpochs", "type": "uint256[]" }], "name": "requestLpWithdrawFromEpochs", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "requestEpoch", "type": "uint256" }], "name": "claimWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// --- TYPES ---
interface Position { id: number; epoch: number; date: string; entryPrice: number; shares: number; valUSD: number; }

interface WithdrawBucket { 
  idEpoch: number; 
  sharesRequested: number; 
  totalUsdAllocatedToBucket: number; 
  globalProgress: number; 
  claimableUSDC: number; 
  alreadyWithdrawn: number; 
  status: 'Processing' | 'Filling' | 'Ready' | 'Completed';
}

// --- COMPOSANT MOBILE ---
export const VaultMobile = () => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'withdraws'>('overview');
  const [depositInput, setDepositInput] = useState<string>('');
  const [reduceInput, setReduceInput] = useState<string>('');
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [userPositions, setUserPositions] = useState<Position[]>([]);
  const [withdrawBuckets, setWithdrawBuckets] = useState<WithdrawBucket[]>([]);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  
  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const validUsdcAddress = isAddress(USDC_ADDRESS) ? USDC_ADDRESS : undefined;

  // --- READS ---
  const { data: currentEpochData } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'currentEpoch', watch: true });
  const currentEpoch = currentEpochData ? Number(currentEpochData) : 0;

  const epochForPrice = currentEpoch > 0 ? BigInt(currentEpoch - 1) : BigInt(0);
  const { data: lpPriceData } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lpTokenPrice', args: [epochForPrice], watch: true });
  const lpPrice = lpPriceData ? parseFloat(formatUnits(lpPriceData, 18)) : 1.0;

  const { data: totalCapitalData } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getLpTotalCapital6', watch: true });
  const tvl = totalCapitalData ? parseFloat(formatUnits(totalCapitalData, 6)) : 0;

  const { data: pendingDepositData, refetch: refetchPending } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'pendingDepositOf', args: [address!, BigInt(currentEpoch)], query: { enabled: !!address } });
  const pendingDeposit = pendingDepositData ? parseFloat(formatUnits(pendingDepositData, 6)) : 0;

  const { data: equityData, refetch: refetchEquity } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'computeLpShares', args: [address!], query: { enabled: !!address } });
  const activeShares = equityData ? parseFloat(formatUnits(equityData[0], 18)) : 0;
  const equityValue = (activeShares * lpPrice) + pendingDeposit;

  const { data: balanceData } = useBalance({ address, token: validUsdcAddress, query: { enabled: !!address && !!validUsdcAddress } });
  const walletBalance = balanceData ? parseFloat(balanceData.formatted) : 0;

  // --- FETCHING LOGIC ---
  const fetchUserData = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      // 1. Positions
      const epochsCount = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getLpEpochsCount', args: [address] });
      const positionsTemp: Position[] = [];
      for (let i = 0; i < Number(epochsCount); i++) {
        const epochId = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getLpEpochAt', args: [address, BigInt(i)] });
        const shares = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getLpSharesForEpoch', args: [address, epochId] });
        if (shares > 0n) {
            const sharesFmt = parseFloat(formatUnits(shares, 18));
            positionsTemp.push({ id: Number(epochId), epoch: Number(epochId), date: `Epoch #${epochId}`, entryPrice: lpPrice, shares: sharesFmt, valUSD: sharesFmt * lpPrice });
        }
      }
      setUserPositions(positionsTemp);

      // 2. Withdrawals
      const withdrawCount = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getWithdrawEpochsCount', args: [address] });
      const withdrawsTemp: WithdrawBucket[] = [];

      for (let i = 0; i < Number(withdrawCount); i++) {
        const reqEpochId = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getWithdrawEpochAt', args: [address, BigInt(i)] });
        const bucketInfo = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdrawBuckets', args: [reqEpochId] });
        const userInfo = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'userWithdraws', args: [reqEpochId, address] });
        
        const totalSharesInitial = bucketInfo[0];
        const sharesRemaining = bucketInfo[1];
        const totalUsdAllocated = bucketInfo[2];
        const sharesRequested = userInfo[0];
        const alreadyWithdrawn = userInfo[1];

        if (sharesRequested > 0n) {
            const sharesRequestedFmt = parseFloat(formatUnits(sharesRequested, 18));
            const alreadyWithdrawnFmt = parseFloat(formatUnits(alreadyWithdrawn, 6));
            
            let globalProgress = 0;
            if (totalSharesInitial > 0n) {
                const filled = totalSharesInitial - sharesRemaining;
                globalProgress = Number((filled * 100n) / totalSharesInitial);
            }

            let userTotalEntitlement = 0n;
            if (totalSharesInitial > 0n) userTotalEntitlement = (sharesRequested * totalUsdAllocated) / totalSharesInitial;

            let claimableNow = 0n;
            if (userTotalEntitlement > alreadyWithdrawn) claimableNow = userTotalEntitlement - alreadyWithdrawn;
            const claimableNowFmt = parseFloat(formatUnits(claimableNow, 6));

            let status: 'Processing' | 'Filling' | 'Ready' | 'Completed' = 'Processing';
            if (alreadyWithdrawn > 0n && claimableNow === 0n && globalProgress === 100) status = 'Completed';
            else if (claimableNow > 0n) status = (globalProgress === 100) ? 'Ready' : 'Filling';

            withdrawsTemp.push({
                idEpoch: Number(reqEpochId),
                sharesRequested: sharesRequestedFmt,
                totalUsdAllocatedToBucket: parseFloat(formatUnits(totalUsdAllocated, 6)),
                globalProgress: globalProgress,
                claimableUSDC: claimableNowFmt,
                alreadyWithdrawn: alreadyWithdrawnFmt,
                status: status
            });
        }
      }
      setWithdrawBuckets(withdrawsTemp);

    } catch (e) { console.error("Error fetching data", e); }
  }, [address, publicClient, lpPrice]);

  useEffect(() => { fetchUserData(); }, [fetchUserData, isConfirmed]);
  useEffect(() => { refetchPending(); refetchEquity(); }, [isConfirmed, refetchPending, refetchEquity]);

  useEffect(() => {
    const checkDark = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    checkDark();
  }, []);

  useEffect(() => {
    if (isConfirmed) { toast({title: "Success", description: "Transaction confirmed."}); setDepositInput(''); setReduceInput(''); setSelectedPositions([]); }
    if (writeError) toast({title: "Error", description: "Transaction failed.", variant: "destructive"});
  }, [isConfirmed, writeError, toast]);

  // --- HANDLERS ---
  const handleDeposit = () => { if (!depositInput || parseFloat(depositInput) <= 0) return; writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'requestLpDeposit', args: [parseUnits(depositInput, 6)] }); };
  const handleReduceDeposit = () => { if (!reduceInput || parseFloat(reduceInput) <= 0) return; writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'reduceLpDeposit', args: [parseUnits(reduceInput, 6)] }); };
  const handleCancelDeposit = () => { if (pendingDeposit <= 0) return; writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'reduceLpDeposit', args: [parseUnits(pendingDeposit.toString(), 6)] }); };
  const handleRequestWithdraw = () => { if (selectedPositions.length === 0) return; const epochs = selectedPositions.map(id => BigInt(id)); writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'requestLpWithdrawFromEpochs', args: [epochs] }); };
  const handleClaim = (epochId: number) => { writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'claimWithdraw', args: [BigInt(epochId)] }); };
  const togglePositionSelection = (id: number) => { setSelectedPositions(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]); };

  const chartData = { labels: Array.from({length: 30}, (_, i) => i), datasets: [{ data: Array.from({length: 30}, () => Math.random() * 0.1 + 1), borderColor: isDarkMode ? '#f4f4f5' : '#1e293b', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 }] };
  const chartOptions: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black overflow-y-auto pb-24">
      
      {/* --- TOP TABS --- */}
      <div className="flex p-2 bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-20">
        <button onClick={() => setActiveTab('overview')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>Overview</button>
        <button onClick={() => setActiveTab('positions')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'positions' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>Positions ({userPositions.length})</button>
        <button onClick={() => setActiveTab('withdraws')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'withdraws' ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'text-slate-500'}`}>Withdraws ({withdrawBuckets.length})</button>
      </div>

      <div className="p-4 space-y-6">

        {/* ======================= OVERVIEW TAB ======================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 bg-white dark:bg-zinc-900 border-none shadow-sm">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Total Vault Value</div>
                <div className="text-lg font-bold dark:text-white">${(tvl / 1000000).toFixed(1)}M</div>
              </Card>
              <Card className="p-3 bg-white dark:bg-zinc-900 border-none shadow-sm">
                <div className="text-[10px] text-slate-500 uppercase font-bold">LP Price</div>
                <div className="text-lg font-bold dark:text-white">{lpPrice.toFixed(4)} <span className="text-xs text-green-500">+1.2%</span></div>
              </Card>
              <Card className="p-3 bg-white dark:bg-zinc-900 border-none shadow-sm">
                <div className="text-[10px] text-slate-500 uppercase font-bold">My Equity</div>
                <div className="text-lg font-bold dark:text-white">${equityValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
              </Card>
               <Card className="p-3 bg-white dark:bg-zinc-900 border-none shadow-sm">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Pending Deposit</div>
                <div className="text-lg font-bold text-amber-500">${pendingDeposit.toFixed(0)}</div>
              </Card>
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 h-48 border border-gray-100 dark:border-zinc-800">
               <Line data={chartData} options={chartOptions} />
            </div>

            {/* Deposit Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-bold">
                 <ArrowDownToLine className="w-5 h-5" /> Deposit Liquidity
              </div>
              
              {!isConnected ? (
                <div className="text-center text-sm text-slate-400 py-4">Connect wallet to deposit</div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      placeholder="0.00"
                      className="h-12 pl-4 pr-16 bg-slate-50 dark:bg-black border-none text-lg"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">USDC</div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-slate-500 px-1">
                    <span>Balance: {walletBalance.toFixed(2)}</span>
                    <button onClick={() => setDepositInput(walletBalance.toString())} className="text-blue-500 font-bold">MAX</button>
                  </div>

                  <Button 
                    onClick={handleDeposit} 
                    disabled={isPending || isConfirming}
                    className="w-full h-12 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold text-base"
                  >
                    {isPending ? 'Processing...' : 'Deposit Funds'}
                  </Button>
                  <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3"/> Processed at Epoch #{currentEpoch} end
                  </p>
                </div>
              )}
            </div>

            {/* Pending Management */}
            {pendingDeposit > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-5 border border-amber-100 dark:border-amber-900/30">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase">Pending Deposit</span>
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-400">${pendingDeposit.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                   <Input 
                      type="number" 
                      value={reduceInput}
                      onChange={(e) => setReduceInput(e.target.value)}
                      placeholder="Amount to reduce"
                      className="bg-white dark:bg-black border-none h-10 text-xs"
                    />
                   <Button size="sm" onClick={handleReduceDeposit} disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white h-10">Reduce</Button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCancelDeposit} disabled={isPending} className="w-full mt-2 text-red-500 h-8 text-xs hover:bg-red-50 dark:hover:bg-red-900/20">Cancel All Pending</Button>
              </div>
            )}
          </div>
        )}

        {/* ======================= POSITIONS TAB ======================= */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center pb-2">
                <span className="text-xs text-slate-500 font-bold uppercase">{userPositions.length} Epochs Active</span>
                <Button 
                  size="sm" 
                  onClick={handleRequestWithdraw} 
                  disabled={selectedPositions.length === 0 || isPending}
                  className={`${selectedPositions.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600'}`}
                >
                  Withdraw ({selectedPositions.length})
                </Button>
             </div>

             {userPositions.length === 0 ? (
               <div className="text-center py-10 text-slate-400 text-sm">No active positions.</div>
             ) : (
               userPositions.map((pos) => (
                 <div 
                    key={pos.id} 
                    onClick={() => togglePositionSelection(pos.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center
                      ${selectedPositions.includes(pos.id) 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                        : 'bg-white border-gray-100 dark:bg-zinc-900 dark:border-zinc-800'}`}
                 >
                    <div>
                      <div className="text-xs font-bold text-slate-500 mb-1">Epoch #{pos.epoch}</div>
                      <div className="font-mono text-sm dark:text-white">{pos.shares.toFixed(2)} Shares</div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-slate-400 mb-1">Entry: ${pos.entryPrice.toFixed(2)}</div>
                       <div className="font-bold text-base dark:text-white">${pos.valUSD.toFixed(2)}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ml-3 ${selectedPositions.includes(pos.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                        {selectedPositions.includes(pos.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                 </div>
               ))
             )}
          </div>
        )}

        {/* ======================= WITHDRAWS TAB ======================= */}
        {activeTab === 'withdraws' && (
          <div className="space-y-4">
             <div className="text-xs text-slate-500 font-bold uppercase pb-2">Withdrawal Queue</div>
             
             {withdrawBuckets.length === 0 ? (
               <div className="text-center py-10 text-slate-400 text-sm">No withdrawals in progress.</div>
             ) : (
               withdrawBuckets.map((req, idx) => {
                  let statusColor = "text-slate-500 bg-slate-100 dark:bg-zinc-800";
                  if (req.status === 'Ready') statusColor = "text-green-600 bg-green-100 dark:bg-green-900/30";
                  if (req.status === 'Filling') statusColor = "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
                  if (req.status === 'Completed') statusColor = "text-blue-600 bg-blue-100 dark:bg-blue-900/30";

                  return (
                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800">
                       <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-xs font-bold text-slate-400 block mb-1">Epoch #{req.idEpoch}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusColor}`}>{req.status}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-400 block">Requested</span>
                            <span className="font-mono text-sm dark:text-white">{req.sharesRequested.toFixed(2)} Shares</span>
                          </div>
                       </div>

                       {/* Progress Bar */}
                       {(req.status === 'Processing' || req.status === 'Filling') && (
                          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-3">
                              <div className="bg-blue-500 h-full transition-all" style={{ width: `${req.globalProgress}%` }}></div>
                          </div>
                       )}

                       {/* Action */}
                       <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-zinc-800">
                          <span className="text-xs text-slate-500">Claimable: <b className="text-slate-900 dark:text-white">${req.claimableUSDC.toFixed(2)}</b></span>
                          <Button 
                             size="sm" 
                             disabled={req.claimableUSDC <= 0 || isPending}
                             onClick={() => handleClaim(req.idEpoch)}
                             className="h-8 text-xs bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black"
                          >
                             Claim Funds
                          </Button>
                       </div>
                    </div>
                  )
               })
             )}
          </div>
        )}

      </div>
    </div>
  );
}
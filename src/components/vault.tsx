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
  useReadContract
} from 'wagmi';
import { useBalance } from 'wagmi';
import { formatUnits, parseUnits, isAddress } from 'viem';
import { ChevronUp, ChevronDown } from 'lucide-react';

// --- 1. CONFIGURATION ---

const VAULT_ADDRESS = "0x3d0184662932E27748E4f9954D59ba1B17EE5Fe0";
const USDC_ADDRESS = "0x16b90aeb3de140dde993da1d5734bca28574702b"; 

const ERC20_ABI = [
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
] as const;

const VAULT_ABI = [
  { "inputs": [], "name": "currentEpoch", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "lpTokenPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getLpTotalCapital6", "outputs": [{ "internalType": "uint256", "name": "total6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lpFreeCapital", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "lpLockedCapital", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "name": "pendingDepositOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "computeLpShares", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }, { "internalType": "uint256", "name": "pendingCurrentEpoch6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getLpEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getLpEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "e", "type": "uint256" }], "name": "getLpSharesForEpoch", "outputs": [{ "internalType": "uint256", "name": "shares18", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }], "name": "getWithdrawEpochsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "lp", "type": "address" }, { "internalType": "uint256", "name": "index", "type": "uint256" }], "name": "getWithdrawEpochAt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "userWithdraws", "outputs": [{ "internalType": "uint256", "name": "sharesRequested18", "type": "uint256" }, { "internalType": "uint256", "name": "usdWithdrawn6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "withdrawBuckets", "outputs": [{ "internalType": "uint256", "name": "totalSharesInitial18", "type": "uint256" }, { "internalType": "uint256", "name": "sharesRemaining18", "type": "uint256" }, { "internalType": "uint256", "name": "totalUsdAllocated6", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "requestLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount6", "type": "uint256" }], "name": "reduceLpDeposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256[]", "name": "depositEpochs", "type": "uint256[]" }], "name": "requestLpWithdrawFromEpochs", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "requestEpoch", "type": "uint256" }], "name": "claimWithdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// --- 2. TYPES ---
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

// --- 3. CUSTOM INPUT COMPONENT ---
const StepController = ({ value, onChange, placeholder, symbol, step = 10, min = 0, disabled = false, onMax }: any) => {
  const handleStep = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(min, current + delta);
    onChange(next.toString());
  };

  return (
    <div className="relative flex items-center rounded-md shadow-sm border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 overflow-hidden">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        // Ces classes masquent les flèches du navigateur
        className="block w-full bg-transparent text-slate-900 dark:text-white pl-4 pr-24 py-2 text-sm font-mono focus:outline-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden [-moz-appearance:textfield]"
      />
      <div className="absolute right-8 flex items-center pr-2">
        <span className="text-slate-500 dark:text-zinc-500 text-xs font-bold mr-1">{symbol}</span>
      </div>
      <div className="absolute right-0 top-0 h-full flex flex-col border-l border-slate-200 dark:border-zinc-800 w-8 bg-slate-100 dark:bg-zinc-950">
        <button type="button" onClick={() => handleStep(step)} disabled={disabled} className="h-1/2 flex items-center justify-center border-b border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition">
          <ChevronUp size={14} />
        </button>
        <button type="button" onClick={() => handleStep(-step)} disabled={disabled} className="h-1/2 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 transition">
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
};

// --- COMPONENTS ---
const Notification = ({ title, body, show, onClose }: any) => { useEffect(() => { if (show) { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); } }, [show, onClose]); return (<div className={`fixed bottom-8 right-8 transform transition-all duration-300 z-50 ${show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}><div className="bg-white dark:bg-zinc-900 border-l-4 border-slate-800 dark:border-white shadow-xl rounded p-4 w-80 flex items-start border border-slate-200 dark:border-zinc-800"><div className="mr-3 text-slate-800 dark:text-white mt-0.5"><i className="fa-solid fa-circle-info"></i></div><div><h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4><p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-mono">{body}</p></div></div></div>); };
const StatCard = ({ title, value, subtext, icon, extraClass = "" }: any) => (<div className={`card-shadow bg-white dark:bg-zinc-950 rounded-lg p-4 border border-slate-200 dark:border-zinc-900 ${extraClass}`}><dt className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{title}</dt><dd className={`mt-1 text-2xl font-bold text-slate-900 dark:text-white`}>{value}</dd><div className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400 flex items-center font-bold">{icon && <i className={`${icon} mr-1`}></i>} {subtext}</div></div>);

// --- MAIN ---
export default function VaultInterface() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [activeTab, setActiveTab] = useState<'assets' | 'withdraws'>('assets');
  const [depositInput, setDepositInput] = useState<string>('');
  const [reduceInput, setReduceInput] = useState<string>('');
  const [notification, setNotification] = useState({ show: false, title: '', body: '' });
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [userPositions, setUserPositions] = useState<Position[]>([]);
  const [withdrawBuckets, setWithdrawBuckets] = useState<WithdrawBucket[]>([]);

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
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
  const { data: freeCapitalData } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lpFreeCapital', watch: true });
  const { data: lockedCapitalData } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lpLockedCapital', watch: true });

  const tvl = totalCapitalData ? parseFloat(formatUnits(totalCapitalData, 6)) : 0;
  const freeCap = freeCapitalData ? parseFloat(formatUnits(freeCapitalData, 6)) : 0;
  const lockedCap = lockedCapitalData ? parseFloat(formatUnits(lockedCapitalData, 6)) : 0;
  const utilizationRate = tvl > 0 ? (lockedCap / tvl) * 100 : 0;

  const { data: pendingDepositData, refetch: refetchPending } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'pendingDepositOf', args: [address!, BigInt(currentEpoch)], query: { enabled: !!address } });
  const pendingDeposit = pendingDepositData ? parseFloat(formatUnits(pendingDepositData, 6)) : 0;

  const { data: equityData, refetch: refetchEquity } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'computeLpShares', args: [address!], query: { enabled: !!address } });
  const activeShares = equityData ? parseFloat(formatUnits(equityData[0], 18)) : 0;
  const equityValue = (activeShares * lpPrice) + pendingDeposit;

  const { data: balanceData } = useBalance({ address, token: validUsdcAddress, query: { enabled: !!address && !!validUsdcAddress } });
  const walletBalance = balanceData ? parseFloat(balanceData.formatted) : 0;

  // LECTURE ALLOWANCE
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: validUsdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, VAULT_ADDRESS] : undefined,
    query: { enabled: !!address }
  });
  const allowance = allowanceData ? (allowanceData as bigint) : 0n;

  // LOGIQUE APPROVE
  const depositAmountBigInt = depositInput && !isNaN(parseFloat(depositInput)) ? parseUnits(depositInput, 6) : 0n;
  const needsApproval = depositAmountBigInt > 0n && allowance < depositAmountBigInt;

  // --- COMPLEX FETCHING LOGIC ---
  const fetchUserData = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
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

      const withdrawCount = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getWithdrawEpochsCount', args: [address] });
      const withdrawsTemp: WithdrawBucket[] = [];

      for (let i = 0; i < Number(withdrawCount); i++) {
        const reqEpochId = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'getWithdrawEpochAt', args: [address, BigInt(i)] });
        const bucketInfo = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'withdrawBuckets', args: [reqEpochId] });
        const totalSharesInitial = bucketInfo[0];
        const sharesRemaining = bucketInfo[1];
        const totalUsdAllocated = bucketInfo[2];

        const userInfo = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'userWithdraws', args: [reqEpochId, address] });
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
            if (totalSharesInitial > 0n) {
                userTotalEntitlement = (sharesRequested * totalUsdAllocated) / totalSharesInitial;
            }

            let claimableNow = 0n;
            if (userTotalEntitlement > alreadyWithdrawn) {
                claimableNow = userTotalEntitlement - alreadyWithdrawn;
            }
            const claimableNowFmt = parseFloat(formatUnits(claimableNow, 6));

            let status: 'Processing' | 'Filling' | 'Ready' | 'Completed' = 'Processing';
            if (alreadyWithdrawn > 0n && claimableNow === 0n && globalProgress === 100) status = 'Completed'; 
            else if (claimableNow > 0n) { if (globalProgress === 100) status = 'Ready'; else status = 'Filling'; } 
            else status = 'Processing';

            withdrawsTemp.push({ idEpoch: Number(reqEpochId), sharesRequested: sharesRequestedFmt, totalUsdAllocatedToBucket: parseFloat(formatUnits(totalUsdAllocated, 6)), globalProgress, claimableUSDC: claimableNowFmt, alreadyWithdrawn: alreadyWithdrawnFmt, status });
        }
      }
      setWithdrawBuckets(withdrawsTemp);

    } catch (e) { console.error("Error fetching data", e); }
  }, [address, publicClient, lpPrice]);

  useEffect(() => { fetchUserData(); }, [fetchUserData, isConfirmed]);
  useEffect(() => { 
    refetchPending(); 
    refetchEquity(); 
    refetchAllowance(); // Re-fetch l'allowance après toute transaction confirmée
  }, [isConfirmed, refetchPending, refetchEquity, refetchAllowance]);

  useEffect(() => {
    const checkDark = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isConfirmed) { 
        showNotif("Success", "Transaction confirmed."); 
        // Ne vide le champ deposit que si ce n'était pas juste un approve
        if (!needsApproval && depositInput) {
            setDepositInput(''); 
        }
        setReduceInput(''); 
        setSelectedPositions([]); 
    }
    if (writeError) showNotif("Error", "Transaction failed.");
  }, [isConfirmed, writeError]);

  const showNotif = (title: string, body: string) => setNotification({ show: true, title, body });

  // --- ACTIONS WITH APPROVE LOGIC ---
  const handleActionDeposit = () => { 
    if (!depositInput || parseFloat(depositInput) <= 0) return; 
    try { 
        if (needsApproval) {
            writeContract({ 
                address: USDC_ADDRESS, 
                abi: ERC20_ABI, 
                functionName: 'approve', 
                args: [VAULT_ADDRESS, depositAmountBigInt], 
            }); 
            showNotif("Pending", "Approve USDC spending."); 
        } else {
            writeContract({ 
                address: VAULT_ADDRESS, 
                abi: VAULT_ABI, 
                functionName: 'requestLpDeposit', 
                args: [depositAmountBigInt], 
            }); 
            showNotif("Pending", "Sign deposit transaction."); 
        }
    } catch (e) { console.error(e); } 
  };

  const handleReduceDeposit = () => { if (!reduceInput || parseFloat(reduceInput) <= 0) return; try { writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'reduceLpDeposit', args: [parseUnits(reduceInput, 6)], }); showNotif("Pending", "Sign reduce transaction."); } catch (e) { console.error(e); } };
  const handleCancelDeposit = () => { if (pendingDeposit <= 0) return; try { writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'reduceLpDeposit', args: [parseUnits(pendingDeposit.toString(), 6)], }); showNotif("Pending", "Sign cancel transaction."); } catch (e) { console.error(e); } };
  const handleRequestWithdraw = () => { if (selectedPositions.length === 0) return; try { const epochs = selectedPositions.map(id => BigInt(id)); writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'requestLpWithdrawFromEpochs', args: [epochs], }); showNotif("Pending", "Sign withdrawal request."); } catch (e) { console.error(e); } };
  const handleClaim = (epochId: number) => { try { writeContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'claimWithdraw', args: [BigInt(epochId)], }); showNotif("Pending", "Sign claim transaction."); } catch (e) { console.error(e); } };
  const togglePositionSelection = (id: number) => { setSelectedPositions(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]); };

  const chartData = { labels: Array.from({length: 30}, (_, i) => i), datasets: [{ data: Array.from({length: 30}, () => Math.random() * 0.1 + 1), borderColor: isDarkMode ? '#f4f4f5' : '#1e293b', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.4 }] };
  const chartOptions: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } };

  if (!isMounted) return null;

  return (
    <div className="bg-slate-50 dark:bg-black text-slate-800 dark:text-zinc-200 min-h-screen font-mono p-8 transition-colors duration-300">
      <main className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* --- LEFT COLUMN --- */}
          <div className="col-span-12 lg:col-span-3 space-y-6 sticky top-8">
            <div className="card-shadow bg-white dark:bg-zinc-950 rounded-lg p-6 border border-slate-200 dark:border-zinc-900 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center border-b border-slate-100 dark:border-zinc-900 pb-3 uppercase"><i className="fa-solid fa-arrow-down text-slate-700 dark:text-white mr-2"></i> Deposit Liquidity</h3>
              {!isConnected ? ( <div className="text-center py-4 text-xs text-slate-500 dark:text-zinc-500">Connect wallet to deposit.</div> ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 mb-2 uppercase">Amount (USDC)</label>
                    <StepController 
                      value={depositInput} 
                      onChange={setDepositInput} 
                      placeholder="0.00" 
                      symbol="USDC" 
                      step={10} 
                      disabled={isPending || isConfirming}
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 dark:text-zinc-500"><span>Wallet: {walletBalance.toFixed(2)} USDC</span><span className="cursor-pointer text-slate-600 dark:text-zinc-300 hover:underline font-bold" onClick={() => setDepositInput(walletBalance.toString())}>Max</span></div>
                  </div>
                  <button 
                    onClick={handleActionDeposit} 
                    disabled={isPending || isConfirming || !depositInput || parseFloat(depositInput) <= 0} 
                    className="w-full bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold py-3 rounded text-sm uppercase tracking-wide transition shadow-md disabled:opacity-50"
                  >
                    {isPending || isConfirming ? 'Processing...' : needsApproval ? '1. Approve USDC' : '2. Deposit'}
                  </button>
                  <div className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 rounded text-[10px] text-slate-600 dark:text-zinc-400"><i className="fa-solid fa-circle-info mr-1"></i> Deposits process at Epoch #{currentEpoch} end.</div>
                </div>
              )}
            </div>

            {isConnected && pendingDeposit > 0 && (
              <div className="card-shadow bg-white dark:bg-zinc-950 rounded-lg p-6 border border-slate-300 dark:border-zinc-800 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-zinc-900 pb-2"><h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase">Pending Deposit</h3><span className="bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Waiting</span></div>
                <div className="space-y-4">
                  <div><p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase">Current Pending</p><p className="text-xl font-bold text-slate-900 dark:text-white">{pendingDeposit.toFixed(2)} USDC</p></div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 mb-2 uppercase">Reduce Amount</label>
                    <div className="relative">
                        <StepController 
                            value={reduceInput} 
                            onChange={setReduceInput} 
                            placeholder="0.00" 
                            symbol="USDC" 
                            step={10} 
                            disabled={isPending || isConfirming}
                        />
                        <button className="absolute inset-y-0 right-8 px-2 text-[10px] font-bold text-blue-600 uppercase hover:text-blue-800 z-10 bg-transparent" onClick={() => setReduceInput(pendingDeposit.toString())}>Max</button>
                    </div>
                  </div>
                  <div className="flex space-x-2"><button onClick={handleReduceDeposit} disabled={isPending || isConfirming} className="flex-1 border border-slate-400 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 text-xs font-bold py-2 rounded uppercase transition disabled:opacity-50">Reduce</button><button onClick={handleCancelDeposit} disabled={isPending || isConfirming} className="flex-1 border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-zinc-900 text-xs font-bold py-2 rounded uppercase transition disabled:opacity-50">Cancel All</button></div>
                </div>
              </div>
            )}
          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="col-span-12 lg:col-span-9 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="LP Token Price" value={`${lpPrice.toFixed(4)} USDC`} subtext="+2.4% (30d)" icon="fa-solid fa-arrow-trend-up" extraClass="text-slate-900 dark:text-white" />
              <StatCard title="Total Vault Value (TVL)" value={`${(tvl / 1000000).toFixed(2)}M $`} subtext={`Free: ${(freeCap/1000000).toFixed(2)}M | Locked: ${(lockedCap/1000000).toFixed(2)}M`} extraClass="text-slate-900 dark:text-white" />
              <StatCard title="Utilization Rate" value={`${utilizationRate.toFixed(1)}%`} subtext="Capital deployed" extraClass="text-slate-800 dark:text-zinc-200" />
              <StatCard title="Estimated Equity" value={`${equityValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} $`} subtext="Active Shares + Pending" extraClass="text-slate-900 dark:text-white" />
            </div>

            <div className="card-shadow bg-white dark:bg-zinc-950 rounded-lg p-6 border border-slate-200 dark:border-zinc-900"><div className="h-[350px] w-full"><Line data={chartData} options={chartOptions} /></div></div>

            <div>
              <div className="flex space-x-6 border-b border-slate-200 dark:border-zinc-800 mb-6">
                <button onClick={() => setActiveTab('assets')} className={`pb-3 text-sm font-bold border-b-2 transition ${activeTab === 'assets' ? 'text-slate-900 border-slate-900 dark:text-white dark:border-white' : 'text-slate-400 border-transparent hover:text-slate-600 dark:text-zinc-500'}`}>My Active Positions</button>
                <button onClick={() => setActiveTab('withdraws')} className={`pb-3 text-sm font-bold border-b-2 transition ${activeTab === 'withdraws' ? 'text-slate-900 border-slate-900 dark:text-white dark:border-white' : 'text-slate-400 border-transparent hover:text-slate-600 dark:text-zinc-500'}`}>Withdrawals & Claims</button>
              </div>

              {activeTab === 'assets' && (
                <div className="card-shadow bg-white dark:bg-zinc-950 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-900">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-900 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">Epoch History</h3>
                    <button onClick={handleRequestWithdraw} disabled={selectedPositions.length === 0 || isPending || isConfirming} className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wide transition ${selectedPositions.length > 0 ? 'bg-slate-800 hover:bg-slate-900 dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white shadow-md' : 'bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'}`}>Request Withdraw ({selectedPositions.length})</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 dark:text-zinc-500 uppercase bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800"><tr><th className="p-4 w-12 text-center">#</th><th className="px-6 py-3 font-bold">Epoch</th><th className="px-6 py-3 font-bold">Entry Price</th><th className="px-6 py-3 font-bold text-right">Shares</th><th className="px-6 py-3 font-bold text-right">Value (Est)</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                        {userPositions.length === 0 ? (<tr><td colSpan={5} className="text-center py-12"><p className="text-slate-400 dark:text-zinc-600 text-sm">No active positions found.</p></td></tr>) : (userPositions.map((pos) => (<tr key={pos.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900 transition group"><td className="w-4 p-4 text-center"><input type="checkbox" checked={selectedPositions.includes(pos.id)} onChange={() => togglePositionSelection(pos.id)} className="w-4 h-4 text-slate-800 border-slate-300 rounded cursor-pointer accent-slate-800 dark:accent-white" /></td><td className="px-6 py-4 font-mono text-slate-600 dark:text-zinc-400">#{pos.epoch}</td><td className="px-6 py-4 font-mono text-slate-500 dark:text-zinc-500">{pos.entryPrice.toFixed(4)}</td><td className="px-6 py-4 font-mono text-slate-800 dark:text-zinc-300 font-bold text-right">{pos.shares.toFixed(2)}</td><td className="px-6 py-4 font-mono text-right font-bold text-slate-900 dark:text-white">{pos.valUSD.toFixed(2)} $</td></tr>)))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'withdraws' && (
                <div className="card-shadow bg-white dark:bg-zinc-950 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-900">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-900"><h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wide">Withdrawal Queue</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 dark:text-zinc-500 uppercase bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800"><tr><th className="px-6 py-3 font-bold">Epoch ID</th><th className="px-6 py-3 font-bold text-right">Requested</th><th className="px-6 py-3 font-bold">Status</th><th className="px-6 py-3 font-bold text-right">Action</th></tr></thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                        {withdrawBuckets.length === 0 ? (<tr><td colSpan={4} className="text-center py-12"><p className="text-slate-400 dark:text-zinc-600 text-sm">No active withdrawals.</p></td></tr>) : (withdrawBuckets.map((req, idx) => {
                            let badgeClass = "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400";
                            if (req.status === 'Ready') badgeClass = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800";
                            else if (req.status === 'Filling') badgeClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800";
                            else if (req.status === 'Completed') badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800";

                            return (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-900 transition">
                                <td className="px-6 py-4 font-mono text-slate-600 dark:text-zinc-400">#{req.idEpoch}</td>
                                <td className="px-6 py-4 font-mono text-slate-500 dark:text-zinc-500 text-right">{req.sharesRequested.toFixed(2)} Shares</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <div className='flex items-center gap-2'>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded w-fit ${badgeClass}`}>
                                            {req.status === 'Ready' || req.status === 'Filling' ? `${req.status.toUpperCase()} ($${req.claimableUSDC.toFixed(2)})` : req.status.toUpperCase()}
                                        </span>
                                    </div>
                                    {/* Progress Bar pour Filling/Processing */}
                                    {(req.status === 'Processing' || req.status === 'Filling') && (
                                        <div className="w-24 bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                            <div className="bg-slate-400 dark:bg-zinc-500 h-full transition-all duration-500" style={{ width: `${req.globalProgress}%` }}></div>
                                        </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {(req.status === 'Ready' || req.status === 'Filling') ? (
                                    <button 
                                      onClick={() => handleClaim(req.idEpoch)}
                                      disabled={isPending || isConfirming}
                                      className="text-white bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black px-4 py-2 rounded text-xs font-bold uppercase shadow-md transition"
                                    >
                                      Claim
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 dark:text-zinc-600 text-xs font-bold uppercase bg-slate-100 dark:bg-zinc-900 px-2 py-1 rounded">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Notification show={notification.show} title={notification.title} body={notification.body} onClose={() => setNotification({ ...notification, show: false })} />
    </div>
  );
}
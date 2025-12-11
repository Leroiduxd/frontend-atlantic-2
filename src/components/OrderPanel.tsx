import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useVault } from "@/hooks/useVault";
import { useToast } from "@/hooks/use-toast";
import { SpiceDeposit, SpiceBalance, useSpiceBalance } from "@spicenet-io/spiceflow-ui";
import { Asset } from "./ChartControls";
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { MarketClosedBanner } from "./MarketClosedBanner";
// Wagmi/Viem Imports
import { useWriteContract, useConfig, useAccount, useSwitchChain } from 'wagmi';
// 🛑 Import du hook Paymaster
import { usePaymaster, PaymasterOpenParams } from "@/hooks/usePaymaster";
import { Landmark, Send, ChevronUp, ChevronDown, Fuel } from "lucide-react";
import { Hash } from 'viem';
import { customChain } from "@/config/wagmi";
import { useVaultBalances } from "@/hooks/useVaultBalances";

// Import du hook de statut de marché
import { useMarketStatus } from "@/hooks/useMarketStatus";

// --- CONSTANTES GLOBALES (Unchanged) ---
const VAULT_ADDRESS = '0x19e9e0c71b672aaaadee26532da80d330399fa11' as const;
const TOKEN_ADDRESS = '0x16b90aeb3de140dde993da1d5734bca28574702b' as const;
const TRADING_ADDRESS = '0xED853d3fD0da9b6c218124407419a47e5F9d8cC3' as const;
const TRADING_ABI = [
	{
		inputs: [
			{ internalType: 'uint32', name: 'assetId', type: 'uint32' },
			{ internalType: 'bool', name: 'longSide', type: 'bool' },
			{ internalType: 'uint16', name: 'leverageX', type: 'uint16' },
			{ internalType: 'uint16', name: 'lots', type: 'uint16' },
			{ internalType: 'int64', name: 'targetX6', type: 'int64' },
			{ internalType: 'int64', name: 'slX6', type: 'int64' },
			{ internalType: 'int64', name: 'tpX6', type: 'int64' },
		],
		name: 'openLimit',
		outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{ internalType: 'bytes', name: 'proof', type: 'bytes' },
			{ internalType: 'uint32', name: 'assetId', type: 'uint32' },
			{ internalType: 'bool', name: 'longSide', type: 'bool' },
			{ internalType: 'uint16', name: 'leverageX', type: 'uint16' },
			{ internalType: 'uint16', name: 'lots', type: 'uint16' },
			{ internalType: 'int64', name: 'slX6', type: 'int64' },
			{ internalType: 'int64', name: 'tpX6', type: 'int64' },
		],
		name: 'openMarket',
		outputs: [{ internalType: 'uint32', name: 'id', type: 'uint32' }],
		stateMutability: 'nonpayable',
		type: 'function'
	}
] as const;
// ---------------------------------------------------

// (StepController) - Ajusté pour un design compact
interface StepControllerProps {
	value: string | number;
	onChange: (value: any) => void;
	step: number;
	min?: number;
	max?: number;
	decimals?: number;
	label?: string; // Optionnel
	unit?: string;  // Optionnel
	isCompact?: boolean;
}
const StepController: React.FC<StepControllerProps> = ({
	value, onChange, step, min = 0, max = Infinity, decimals = 2, isCompact = false
}) => {
	const numericValue = Number(value);
	const handleStep = (delta: number) => {
		const newValue = Math.min(max, Math.max(min, numericValue + delta));
		const finalDecimals = isCompact && step === 1 ? 0 : decimals;
		onChange(Number(newValue.toFixed(finalDecimals)));
	};
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		onChange(val);
	};

	// Ajustement des largeurs pour un StepController compact
	const widthClass = isCompact ? 'w-full text-center h-7 text-xs p-1 pr-5' : 'w-full text-lg font-medium pr-10';
	const buttonWidth = isCompact ? 'w-5' : 'w-8';
	const iconSize = isCompact ? 'w-3 h-3' : 'w-4 h-4';

	return (
		<div className="relative flex items-center">
			<Input
				type="text"
				placeholder="0.00"
				value={value}
				onChange={handleInputChange}
				className={widthClass}
			/>
			{/* Les boutons + et - sont maintenant plus compacts et les icônes réduites */}
			<div className={`absolute right-0 top-0 h-full flex flex-col justify-center border-l border-border`}>
				<Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 border-b border-border/80 rounded-none rounded-tr-sm`} onClick={() => handleStep(step)}>
					<ChevronUp className={iconSize} />
				</Button>
				<Button variant="ghost" size="icon" className={`h-1/2 ${buttonWidth} p-0 rounded-none rounded-br-sm`} onClick={() => handleStep(-step)}>
					<ChevronDown className={iconSize} />
				</Button>
			</div>
		</div>
	);
};
// ====================================================================


type OrderType = "limit" | "market";

// UTILITY FUNCTION: Fetch Proof (more robust)
const getMarketProof = async (assetId: number): Promise<Hash> => {
	const url = `https://backend.brokex.trade/proof?pairs=${assetId}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch proof for asset ${assetId}. Status: ${response.status}`);
	}

	const data = await response.json();
	const proof = data.proof as string;

	if (!proof || proof.length <= 2 || !proof.startsWith('0x')) {
		throw new Error("Invalid proof received from API.");
	}

	return proof as Hash;
};

// 🛑 MISE À JOUR DES PROPS
interface OrderPanelProps {
	selectedAsset: Asset;
	currentPrice: number;
	paymasterEnabled: boolean;
	onTogglePaymaster: () => void;
}

const OrderPanel = ({
	selectedAsset,
	currentPrice,
	paymasterEnabled,
	onTogglePaymaster
}: OrderPanelProps) => {

	const [orderType, setOrderType] = useState<OrderType>("limit");
	const [tpEnabled, setTpEnabled] = useState(false);
	const [slEnabled, setSlEnabled] = useState(false);
	const [leverage, setLeverage] = useState(10);
	const [lotsDisplay, setLotsDisplay] = useState(0.01);
	const [limitPrice, setLimitPrice] = useState('');
	const [tpPrice, setTpPrice] = useState('');
	const [slPrice, setSlPrice] = useState('');
    // 🛑 Nouvel état pour gérer le survol du bouton Fuel
    const [isHoveringFuel, setIsHoveringFuel] = useState(false); 


	// 🛑 LOADING COMMUN (pour Paymaster ou Wagmi)
	const [localLoading, setLocalLoading] = useState(false);
	const { executeGaslessOrder, isLoading: paymasterLoading } = usePaymaster(); // 🛑 Hook Paymaster
	const { toast } = useToast();
	const loading = localLoading || paymasterLoading; // 🛑 Fusion des états de loading

	const [spiceDepositOpen, setSpiceDepositOpen] = useState(false);
	const [spiceBalanceOpen, setSpiceBalanceOpen] = useState(false);

	const { balance, available, locked, refetchAll, deposit, withdraw } = useVault();
	const { getConfigById, convertDisplayToLots } = useAssetConfig();
	const { totalBalance, refetchAll: refetchBalances } = useVaultBalances();
	const { isConnected, chain: currentChain, address: account } = useAccount();

	// Check if user has Spice balance
	const { balanceData, loading: balanceLoading, hasBalance, refetch: refetchSpiceBalance } = useSpiceBalance({
		address: account,
		enabled: !!account,
		refetchInterval: 30000, // Refetch every 30 seconds
	});

	const { writeContractAsync } = useWriteContract();
	const { switchChainAsync } = useSwitchChain();
	const config = useConfig();
	const publicClient = config.publicClient;

	const finalAssetIdForTx = useMemo(() => {
		const n = Number(selectedAsset.id);
		return Number.isFinite(n) ? n : -1;
	}, [selectedAsset.id]);

	// 🛑 UTILISATION DU HOOK DE STATUT DE MARCHÉ
	const marketStatus = useMarketStatus(finalAssetIdForTx);
	const isMarketOpen = marketStatus.isOpen;

	// Si le marché est fermé, forcer l'ordre Limit
	useEffect(() => {
		if (!isMarketOpen && orderType === "market") {
			setOrderType("limit");
		}
	}, [isMarketOpen, orderType]);

	const assetConfig = getConfigById(finalAssetIdForTx);

	const { minLotSizeDisplay, lotStep, priceDecimals, priceStep } = useMemo(() => {
		// Logique de calcul du lotStep et priceStep
		const num = assetConfig?.lot_num || 1;
		const den = assetConfig?.lot_den || 100;
		const lotSize = num / den;
		const lotStep = lotSize;

		const tickSizeX6 = assetConfig?.tick_size_usd6 || 10000;
		const powerOfTen = Math.round(Math.log10(1000000 / tickSizeX6));
		const decimals = Math.max(0, powerOfTen);
		const step = 1 / (10 ** decimals);

		return {
			minLotSizeDisplay: lotSize,
			lotStep: lotStep,
			priceDecimals: decimals,
			priceStep: step,
		};
	}, [assetConfig]);


	useEffect(() => {
		setLotsDisplay(minLotSizeDisplay);
		if (currentPrice > 0) {
			// Mise à jour de limitPrice uniquement si on est sur Limit au montage
			if (orderType === 'limit') {
				setLimitPrice(currentPrice.toFixed(priceDecimals));
			}
		}
	}, [selectedAsset.id, currentPrice, minLotSizeDisplay, priceDecimals, orderType]);


	const handleLotsChange = (value: number) => {
		setLotsDisplay(value);
	};

	const calculations = useMemo(() => {
		// Utiliser le prix actuel si ordre Market
		const price = orderType === 'limit' && limitPrice ? Number(limitPrice) : currentPrice;

		// Si le prix n'est pas valide (ex: initialisation), éviter les calculs
		if (isNaN(price) || price <= 0 || lotsDisplay <= 0) {
			return { value: 0, cost: 0, liqPriceLong: 0, liqPriceShort: 0 };
		}

		const displayNotional = lotsDisplay * price;

		// La liq price est calculée par rapport au prix d'entrée
		const liqPriceLong = price * (1 - 0.99 / leverage);
		const liqPriceShort = price * (1 + 0.99 / leverage);

		return {
			value: displayNotional,
			cost: displayNotional / leverage,
			liqPriceLong,
			liqPriceShort,
		};
	}, [lotsDisplay, leverage, limitPrice, currentPrice, orderType, priceDecimals]);

	const formatPrice = (value: number) => {
		if (value === 0) return "0.00";
		return value.toFixed(priceDecimals > 5 ? 5 : priceDecimals || 2);
	};

	/**
	 * 🛑 LOGIQUE DE TRADE MISE À JOUR : Support Paymaster
	 */
	const handleTrade = async (longSide: boolean) => {

		// --- 0. MARKET STATUS CHECK ---
		if (!isMarketOpen && orderType === 'market') {
			return toast({
				title: 'Market Closed',
				description: `Market orders are disabled when the market is closed. Please use a Limit order.`,
				variant: "destructive"
			});
		}

		// --- 1. CRITICAL CHECKS ---
		if (finalAssetIdForTx < 0) {
			return toast({ title: 'Configuration Error', description: `Please select a valid trading pair.`, variant: "destructive", });
		}

		const numLimitPrice = Number(limitPrice);
		const numSlPrice = slEnabled ? Number(slPrice) : undefined;
		const numTpPrice = tpEnabled ? Number(tpPrice) : undefined;

		if (orderType === 'limit' && (isNaN(numLimitPrice) || numLimitPrice <= 0)) {
			return toast({ title: 'Input Error', description: 'Please enter a valid Limit Price.', variant: "destructive" });
		}
		// Lot validation
		if (lotsDisplay < minLotSizeDisplay) {
			return toast({ title: 'Input Error', description: `Minimum lot size is ${minLotSizeDisplay}.`, variant: "destructive" });
		}

		// CHECK: AVAILABLE BALANCE (La validation des marges est essentielle quelle que soit la méthode)
		const requiredMargin = calculations.cost;
		const requiredMarginWithBuffer = requiredMargin * 1.01;
		const availableBalance = Number(available);

		if (availableBalance < requiredMarginWithBuffer) {
			return toast({
				title: 'Insufficient Balance',
				description: `Required Margin: $${formatPrice(requiredMarginWithBuffer)}. Available: $${availableBalance}.`,
				variant: "destructive",
			});
		}

		// 2. SL/TP VALIDATION (Validation simplifiée ici)
		const entryPrice = orderType === 'limit' ? numLimitPrice : currentPrice;
		const liqPrice = longSide
			? entryPrice * (1 - 0.99 / leverage)
			: entryPrice * (1 + 0.99 / leverage);

		if (slEnabled && (isNaN(numSlPrice!) || numSlPrice! <= 0)) {
			return toast({ title: 'Input Error', description: 'Please enter a valid Stop Loss Price.', variant: "destructive" });
		}
		if (tpEnabled && (isNaN(numTpPrice!) || numTpPrice! <= 0)) {
			return toast({ title: 'Input Error', description: 'Please enter a valid Take Profit Price.', variant: "destructive" });
		}
		// ... [Validation complète SL/TP si nécessaire] ...

		// Mettre à jour l'état de chargement local si on n'utilise PAS le paymaster
		if (!paymasterEnabled) {
			setLocalLoading(true);
		}

		let txHash: Hash | string | undefined;

		try {
			const actualLots = convertDisplayToLots(lotsDisplay, finalAssetIdForTx);
			let toastId: string | number | undefined;

			// 🛑 LOGIQUE DE BASCULE PAYMASTER VS TRADITIONNEL
			if (paymasterEnabled) {
				// --- 🅰️ MÉTHODE PAYMASTER (Gasless) ---

				// 1. Notification de signature
				toastId = toast({
					title: 'Awaiting Signature...',
					description: 'Please approve the transaction in your wallet to sign the order.',
					duration: 90000, // Longue durée
				}).id;

				const paymasterParams: Omit<PaymasterOpenParams, 'type'> = {
					assetId: finalAssetIdForTx,
					longSide,
					leverage,
					lots: actualLots,
					orderType,
					price: orderType === 'limit' ? numLimitPrice : undefined,
					slPrice: numSlPrice,
					tpPrice: numTpPrice,
				};

				try {
					// 2. Exécution Gasless
					txHash = await executeGaslessOrder(paymasterParams);

					// 3. Notification d'envoi à l'API (Remplacer la précédente)
					toast({
						id: toastId,
						title: 'Order Sent (Gasless)',
						description: `Transaction pending via Paymaster. Tx Hash: ${txHash.substring(0, 10)}...`,
						variant: 'default',
						duration: 90000,
					});

				} catch (paymasterError: any) {
					// 4. Notification d'échec
					const errorMsg = paymasterError?.message || 'Transaction rejected or API failed.';
					toast({
						id: toastId,
						title: 'Gasless Order Failed',
						description: errorMsg.includes('User rejected') ? 'Transaction rejected by user.' : errorMsg,
						variant: 'destructive',
					});
					throw paymasterError; // Propager l'erreur pour le bloc catch final
				}

			} else {
				// --- 🅱️ MÉTHODE TRADITIONNELLE (Wagmi) ---
				const slX6 = numSlPrice ? Math.round(numSlPrice * 1000000) : 0;
				const tpX6 = numTpPrice ? Math.round(numTpPrice * 1000000) : 0;

				if (orderType === 'limit') {
					const targetX6 = Math.round(numLimitPrice * 1000000);

					txHash = await writeContractAsync({
						address: TRADING_ADDRESS,
						abi: TRADING_ABI,
						functionName: 'openLimit',
						args: [
							finalAssetIdForTx,
							longSide,
							leverage,
							actualLots,
							BigInt(targetX6),
							BigInt(slX6),
							BigInt(tpX6)
						],
						chain: currentChain,
						account,
					});

				} else { // Market Order
					const proof = await getMarketProof(finalAssetIdForTx);

					txHash = await writeContractAsync({
						address: TRADING_ADDRESS,
						abi: TRADING_ABI,
						functionName: 'openMarket',
						args: [
							proof,
							finalAssetIdForTx,
							longSide,
							leverage,
							actualLots,
							BigInt(slX6),
							BigInt(tpX6)
						],
						chain: currentChain,
						account,
					});
				}

				// Attendre la confirmation uniquement pour la méthode traditionnelle
				if (!publicClient || !txHash) {
					console.error("Wagmi public client is unavailable or txHash missing.");
				} else {
					// Notification de confirmation Wagmi
					toastId = toast({
						title: 'Transaction Sent',
						description: `Waiting for ${currentChain?.name || 'chain'} confirmation...`,
						duration: 90000,
					}).id;

					await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });

					toast({
						id: toastId,
						title: 'Transaction Confirmed',
						description: 'Your transaction has been successfully mined.',
						variant: 'default',
						duration: 3000,
					});
				}
			}

			// 4. Afficher le succès final (commun)
			const explorerUrl = txHash ? `https://atlantic.pharosscan.xyz/tx/${txHash}` : undefined;
			const successTitle = paymasterEnabled ? 'Gasless Order Placed' : 'Order Placed';

			toast({
				id: toastId, // Mettre à jour la dernière toast
				title: successTitle,
				description: (
					<span className="flex items-center space-x-1">
						<span>{longSide ? 'Buy' : 'Sell'} order placed successfully.</span>
						{explorerUrl && (
							<a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-trading-blue underline flex items-center">
								View Transaction <Send className="w-3 h-3 ml-1" />
							</a>
						)}
					</span>
				),
				duration: 5000,
			});

			// Réinitialisation de l'interface
			setLimitPrice(currentPrice.toFixed(priceDecimals));
			setTpPrice('');
			setSlPrice('');
			setTpEnabled(false);
			setSlEnabled(false);
			setLotsDisplay(minLotSizeDisplay);

			setTimeout(() => refetchAll(), 2000);

		} catch (error: any) {
			console.error("Trade Error:", error);

			// Si l'erreur n'a pas été gérée et affichée par la logique Paymaster
			if (!paymasterEnabled) {
				let errorMsg = error?.message || 'Transaction failed.';

				if (errorMsg.includes('User rejected the request')) {
					errorMsg = 'Transaction rejected by user.';
				} else if (errorMsg.includes('revert')) {
					errorMsg = 'Transaction failed (revert). Proof may have expired or be invalid.';
				} else if (errorMsg.includes('Paymaster API Failed')) {
					errorMsg = errorMsg; // Message d'erreur exact de l'API Paymaster
				}

				toast({
					title: 'Order failed',
					description: errorMsg,
					variant: "destructive",
				});
			}
		} finally {
			if (!paymasterEnabled) {
				setLocalLoading(false);
			}
			// Le Paymaster hook gère son propre loading state
		}
	};


	return (
		<div className="w-[320px] h-full flex flex-col border-l border-border shadow-md bg-card">

			{/* 🛑 BANNER D'AVERTISSEMENT */}
			<MarketClosedBanner status={marketStatus} />

			{/* Order Panel Content (Scrollable) */}
			<div className="flex-grow p-4 space-y-5 overflow-y-auto custom-scrollbar">

				{/* 1. Tabs (Limit, Market) AND Paymaster + Leverage */}
				<div className="flex justify-between items-center border-b border-border text-muted-foreground font-medium text-sm pt-1 pb-2">

					{/* Côté Gauche : Tabs Limit / Market */}
					<div className="flex">
						<div
							className={`py-1 mr-4 cursor-pointer transition duration-150 ${orderType === "limit"
									? "text-foreground border-b-2 border-foreground"
									: "hover:text-foreground"
								}`}
							onClick={() => setOrderType("limit")}
						>
							Limit
						</div>
						{/* Market Tab désactivé si marché fermé */}
						<div
							className={`py-1 mr-4 transition duration-150 ${!isMarketOpen
									? "text-muted-foreground/50 cursor-not-allowed"
									: orderType === "market"
										? "text-foreground border-b-2 border-foreground cursor-pointer"
										: "hover:text-foreground cursor-pointer"
								}`}
							onClick={() => isMarketOpen && setOrderType("market")}
						>
							Market
						</div>
					</div>

					{/* Côté Droit : Leverage Input + Fuel Button */}
					<div className="flex items-center gap-2">

						{/* Input Levier (StepController compact) - Le 'x' est retiré */}
						<div className="flex items-center gap-0">
							<div className="w-20"> {/* Largeur ajustée (w-20) */}
								<StepController
									value={leverage}
									onChange={setLeverage}
									step={1}
									min={1}
									max={100}
									decimals={0}
									isCompact={true}
								/>
							</div>
						</div>

						{/* 🛑 Bouton Fuel Paymaster enveloppé dans un div relative pour le tooltip customisé */}
                        {/* Ce div englobe l'input levier et le bouton fuel pour que le tooltip puisse s'aligner sur toute la largeur droite. */}
                        <div className="relative flex items-center">
                            
                            {/* Le bouton Fuel */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 rounded-md transition-colors ${
                                    paymasterEnabled
                                        ? "bg-amber-400 border-none text-white hover:bg-amber-500" // Couleur ajustée, pas de bordure, texte blanc
                                        : "bg-transparent border border-border text-muted-foreground hover:text-foreground hover:bg-accent" // Bordure quand désactivé
                                    }`}
                                onClick={onTogglePaymaster}
                                onMouseEnter={() => setIsHoveringFuel(true)}
                                onMouseLeave={() => setIsHoveringFuel(false)}
                            >
                                <Fuel className="w-4 h-4" />
                            </Button>

                            {/* 🛑 Tooltip Customisé Simple (Sous le bouton Fuel, aligné à droite) */}
                            {isHoveringFuel && (
                                // Tooltip positionné en bas, aligné à droite du conteneur parent du bouton
                                <div className="absolute z-50 top-full right-0 mt-2 w-max max-w-[200px] rounded-md bg-white p-2 text-xs text-gray-800 shadow-lg border border-gray-200">
                                    <p className="font-semibold text-right">
                                        Gasless Paymaster
                                    </p>
                                    <p className="mt-1 text-right">
                                        Brokex pays network fees for you.
                                    </p>
                                </div>
                            )}
                        </div>
					</div>
				</div>

				{/* 2. Order Input based on type */}
				{orderType === "limit" && (
					<div>
						<span className="text-light-text text-xs block mb-1">Limit Price (USD)</span>
						<StepController
							value={limitPrice}
							onChange={setLimitPrice}
							step={priceStep}
							decimals={priceDecimals}
							label="Price"
							unit="USD"
						/>
					</div>
				)}
				{/* 2.1 Message si Market est sélectionné mais fermé */}
				{orderType === "market" && !isMarketOpen && (
					<div className="p-3 bg-red-100 text-red-800 rounded-md text-sm font-medium">
						Market Orders not allowed while market is closed.
					</div>
				)}


				{/* 3. Amount Input (Lots) */}
				<div>
					<span className="text-light-text text-xs block mb-1">
						Lots ({selectedAsset.symbol.split('/')[0] || 'BTC'})
					</span>
					<StepController
						value={lotsDisplay}
						onChange={handleLotsChange}
						step={lotStep}
						min={minLotSizeDisplay}
						decimals={lotStep >= 1 ? 0 : 2}
						label="Lots"
						unit={selectedAsset.symbol.split('/')[0] || 'BTC'}
					/>
				</div>

				{/* 4. Take Profit / Stop Loss (Unchanged) */}
				<div className="space-y-3">
					{/* Take Profit Toggle */}
					<div>
						<label className="flex items-center text-foreground cursor-pointer mb-2">
							<Checkbox
								checked={tpEnabled}
								onCheckedChange={(checked) => setTpEnabled(checked as boolean)}
								className="mr-2"
							/>
							<span className="text-sm font-medium">Take Profit</span>
						</label>
						{tpEnabled && (
							<StepController
								value={tpPrice}
								onChange={setTpPrice}
								step={priceStep}
								decimals={priceDecimals}
								label="TP Price"
								unit="USD"
							/>
						)}
					</div>

					{/* Stop Loss Toggle */}
					<div>
						<label className="flex items-center text-foreground cursor-pointer mb-2">
							<Checkbox
								checked={slEnabled}
								onCheckedChange={(checked) => setSlEnabled(checked as boolean)}
								className="mr-2"
							/>
							<span className="text-sm font-medium">Stop Loss</span>
						</label>
						{slEnabled && (
							<StepController
								value={slPrice}
								onChange={setSlPrice}
								step={priceStep}
								decimals={priceDecimals}
								label="SL Price"
								unit="USD"
							/>
						)}
					</div>
				</div>

				{/* 5. Buy / Sell Buttons */}
				<div className="flex space-x-3 pt-2 pb-3">
					<Button
						onClick={() => handleTrade(true)}
						// Désactiver si loading OU (Market Order ET marché fermé)
						disabled={loading || (orderType === 'market' && !isMarketOpen)}
						className={`flex-1 ${loading || (orderType === 'market' && !isMarketOpen) ? 'bg-gray-400' : 'bg-trading-blue hover:bg-trading-blue/90'} text-white font-bold shadow-md`}
					>
						{loading ? 'Processing...' : 'Buy'}
					</Button>
					<Button
						onClick={() => handleTrade(false)}
						// Désactiver si loading OU (Market Order ET marché fermé)
						disabled={loading || (orderType === 'market' && !isMarketOpen)}
						className={`flex-1 ${loading || (orderType === 'market' && !isMarketOpen) ? 'bg-gray-400' : 'bg-trading-red hover:bg-trading-red/90'} text-white font-bold shadow-md`}
					>
						{loading ? 'Processing...' : 'Sell'}
					</Button>
				</div>

				{/* 6. Account Details (Calculations) - Unchanged */}
				<div className="text-xs space-y-1.5 pt-3 border-t border-border">
					<div className="flex justify-between text-light-text">
						<span>Value</span>
						<span className="text-foreground">${formatPrice(calculations.value)}</span>
					</div>
					<div className="flex justify-between text-light-text">
						<span>Cost (Margin)</span>
						<span className="text-foreground">${formatPrice(calculations.cost)}</span>
					</div>
					<div className="flex justify-between text-light-text">
						<span>Est. Liq. Price (Long/Short)</span>
						<span className="text-foreground text-[10px]">
							${formatPrice(calculations.liqPriceLong)} / ${formatPrice(calculations.liqPriceShort)}
						</span>
					</div>
				</div>
			</div>

			{/* 7. Deposit Info (Landmark Panel) - Unchanged */}
			<div className="flex-shrink-0 mx-4 mt-2 mb-4 p-4 h-[200px] bg-blue-50 rounded-lg relative overflow-hidden">

				{/* Logo de banque en fond (Landmark) */}
				<div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[33%]">
					<Landmark className="w-48 h-48 text-blue-200 opacity-70" />
				</div>

				{/* Contenu - Aligné à droite */}
				<div className="relative z-10 flex flex-col items-end w-full h-full justify-between">

					{/* Informations (Haut à droite) */}
					<div className="text-xs space-y-1.5 pt-1">
						<div className="flex justify-between items-center w-full">
							<span className="text-light-text min-w-[80px] text-right">Total Balance:</span>
							<span className="font-semibold text-foreground">${balance}</span>
						</div>
						<div className="flex justify-between items-center w-full">
							<span className="text-light-text min-w-[80px] text-right">Available:</span>
							<span className="font-semibold text-foreground">${available}</span>
						</div>
						<div className="flex justify-between items-center w-full">
							<span className="text-light-text min-w-[80px] text-right">Locked Margin:</span>
							<span className="font-semibold text-foreground">${locked}</span>
						</div>
					</div>

					{/* Bouton Deposit/Wallet (Bas à droite) */}
					<div className="w-full flex justify-end">

						{/* Show wallet icon if user has balance, otherwise show deposit button */}
						{totalBalance > 0 ? (
							<Button
								variant="secondary"
								size="sm"
								className="text-xs font-semibold flex items-center gap-2"
								onClick={() => setSpiceBalanceOpen(true)}
								disabled={balanceLoading}
							>
								{balanceLoading ? (
									"Loading..."
								) : (
									<>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<rect x="2" y="4" width="20" height="16" rx="2" />
											<path d="M7 15h0M2 9.5h20" />
										</svg>
										View Balance
									</>
								)}
							</Button>
						) : (
							<Button
								variant="secondary"
								size="sm"
								className="text-xs font-semibold"
								onClick={() => setSpiceDepositOpen(true)}
							>
								Deposit
							</Button>
						)}

						{/* SpiceBalance Modal - Show when user has balance and modal is open */}
						{spiceBalanceOpen && (
							<div
								className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
								onClick={() => setSpiceBalanceOpen(false)}
							>
								<div onClick={(e) => e.stopPropagation()}>
									<SpiceBalance
										balanceData={{
											tradingAccounts: [],
											freeCollateral: 0,
											defiPositions: 0,
											credit: 0,
											totalBalance: totalBalance,
										}}
										isLoading={balanceLoading}
										onDepositClick={() => {
											setSpiceBalanceOpen(false);
											setTimeout(() => setSpiceDepositOpen(true), 100);
										}}
										// Withdraw props for non-EIP-7702 mode
										vaultBalance={parseFloat(available || '0')}
										postWithdrawInstruction={async (amount: string) => {
											console.log('Withdrawing from Brokex vault:', amount);

											// Validate inputs
											if (!isConnected) {
												throw new Error("Wallet not connected");
											}

											if (!amount || amount.trim() === '') {
												throw new Error("Invalid amount");
											}

											const numericAmount = parseFloat(amount);
											if (isNaN(numericAmount) || numericAmount <= 0) {
												throw new Error(`Invalid amount: ${amount}`);
											}

											// Switch to Pharos Testnet Atlantic if needed
											if (currentChain?.id !== customChain.id) {
												console.log(`Switching to chain ${customChain.id}...`);
												await switchChainAsync({ chainId: customChain.id });
												await new Promise(resolve => setTimeout(resolve, 2000));
											}

											// Refetch available balance to ensure we have latest value
											// (positions might have changed available balance)
											console.log('Refetching available balance before withdrawal...');
											await refetchAll();
											await new Promise(resolve => setTimeout(resolve, 500));

											// Execute the withdrawal (withdraw function will validate available balance)
											console.log('Calling withdraw with:', {
												amount,
												numericAmount,
												currentAvailable: parseFloat(available || '0'),
											});

											await withdraw(amount);
											console.log('Withdrawal from Brokex successful');

											// Refresh balances
											setTimeout(() => {
												refetchAll();
												refetchBalances();
												refetchSpiceBalance();
											}, 2000);
										}}
										postWithdrawInstructionLabel="WITHDRAW FROM BROKEX"
										destinationChainId={customChain.id}
										destinationTokenAddress="0x16b90aeb3de140dde993da1d5734bca28574702b"
									/>
								</div>
							</div>
						)}

						{/* SpiceDeposit Modal - Show when user doesn't have balance or when requested from SpiceBalance */}
						<SpiceDeposit

							isOpen={spiceDepositOpen}
							onClose={() => {
								setSpiceDepositOpen(false);
								// Refetch balance after deposit completes
								setTimeout(() => {
									refetchSpiceBalance();
								}, 2000);
							}}
							destinationChainId={customChain.id}
							destinationTokenAddress="0x16b90aeb3de140dde993da1d5734bca28574702b"
							postDepositInstructionLabel="Deposit to Brokex"
							postDepositInstruction={async (bridgedAmount: string) => {
								console.log('postDepositInstruction called with:', bridgedAmount, typeof bridgedAmount);

								// Validate inputs
								if (!isConnected) {
									throw new Error("Wallet not connected");
								}

								if (!bridgedAmount || bridgedAmount.trim() === '') {
									throw new Error("Invalid amount received");
								}

								const amount = parseFloat(bridgedAmount);
								console.log('Parsed amount:', amount);

								if (isNaN(amount) || amount <= 0) {
									throw new Error(`Invalid amount: ${bridgedAmount}`);
								}

								// Switch to Pharos Testnet Atlantic (688689) if not already on it
								console.log('Current chain:', currentChain?.id);
								if (currentChain?.id !== customChain.id) {
									console.log(`Switching to chain ${customChain.id} (${customChain.name})...`);
									try {
										await switchChainAsync({ chainId: customChain.id });
										console.log('Chain switch successful');
									} catch (error: any) {
										console.error('Failed to switch chain:', error);
										throw new Error(`Failed to switch to Pharos Testnet Atlantic: ${error.message}`);
									}

									// Wait 2 seconds after switching chain to allow wallet to sync
									console.log('Waiting 2 seconds after chain switch for wallet sync...');
									await new Promise(resolve => setTimeout(resolve, 2000));
									console.log('Chain sync complete, proceeding with deposit');
								} else {
									console.log('Already on correct chain:', customChain.id);
								}

								// Refetch balances and allowances to ensure we have latest state
								console.log('Refetching balances and allowances...');
								refetchAll();
								refetchBalances();

								// Small delay to let refetch complete
								await new Promise(resolve => setTimeout(resolve, 500));

								// Execute the deposit - SDK will handle showing success/error
								console.log('Executing deposit to Brokex vault with amount:', bridgedAmount);
								await deposit(bridgedAmount);
								console.log('Deposit to Brokex successful');

								// Refresh balances after successful deposit
								setTimeout(() => {
									refetchAll();
									refetchBalances();
								}, 2000);
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default OrderPanel;
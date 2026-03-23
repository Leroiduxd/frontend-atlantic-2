"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWebSocket, getAssetsByCategory } from "@/hooks/useWebSocket";
import { useAssetConfig } from "@/hooks/useAssetConfig";
import { getMarketKindFromId, getMarketStatusUTC } from "@/hooks/useopen";
import { Hash } from 'viem';

// --- CONSTANTES ---
export const WAD = 1000000000000000000n;

export const PAIR_MAP: { [key: number]: string } = {
  6004:'aapl_usd', 6005:'amzn_usd', 6010:'coin_usd', 6003:'goog_usd',
  6011:'gme_usd', 6009:'intc_usd', 6059:'ko_usd', 6068:'mcd_usd',
  6001:'msft_usd', 6066:'ibm_usd', 6006:'meta_usd', 6002:'nvda_usd',
  6000:'tsla_usd', 5010:'aud_usd', 5000:'eur_usd', 5002:'gbp_usd',
  5013:'nzd_usd', 5011:'usd_cad', 5012:'usd_chf', 5001:'usd_jpy',
  5501:'xag_usd', 5500:'xau_usd', 0:'btc_usdt', 1:'eth_usdt',
  10:'sol_usdt', 14:'xrp_usdt', 5:'avax_usdt', 3:'doge_usdt',
  15:'trx_usdt', 16:'ada_usdt', 90:'sui_usdt', 2:'link_usdt',
  6034:'nike_usd', 6113:'spdia_usd', 6114:'qqqm_usd', 6115:'iwm_usd'
};

export const ASSET_LOT_SIZES: Record<number, number> = {
    0: 0.01, 1: 0.01, 2: 1, 3: 1000, 5: 1, 10: 1, 14: 100, 
    15: 1000, 16: 100, 90: 10, 5500: 0.01, 5501: 0.1,
};

// --- FONCTIONS MATHS ET UTILS PURES ---
export const getMarketProof = async (assetId: number): Promise<Hash> => {
    const response = await fetch(`https://backend.brokex.trade/proof?pairs=${assetId}`);
    if (!response.ok) throw new Error(`Failed to fetch proof`);
    return (await response.json()).proof as Hash; 
};

export const calculateExitSpreadDecimal = (assetId: number, isLongTrade: boolean, lotSize: number, exposuresMap: any, baseSpreadsMap: any): number => {
    try {
        const assetExpo = exposuresMap[assetId] || { longLots: "0", shortLots: "0" };
        const baseSpreadStr = baseSpreadsMap[assetId] || "0";
        const base = BigInt(baseSpreadStr);
        let L = BigInt(assetExpo.longLots || "0");
        let S = BigInt(assetExpo.shortLots || "0");
        const size = BigInt(Math.floor(lotSize));
        const isContractLong = !isLongTrade; 

        if (isContractLong) L -= size; else S -= size;
        if (L < 0n) L = 0n;
        if (S < 0n) S = 0n;

        const numerator = L > S ? L - S : S - L;
        const denominator = L + S + 2n;
        if (denominator === 0n) return Number(base) / Number(WAD);

        const r = (numerator * WAD) / denominator;
        const p = (r * r) / WAD;
        const dominant = (L > S && isContractLong) || (S > L && !isContractLong);

        const finalSpreadWad = dominant ? (base * (WAD + 3n * p)) / WAD : base;
        return Number(finalSpreadWad) / Number(WAD);
    } catch (e) {
        return 0;
    }
};

export const formatAssetPrice = (valueX6: number, assetId: number, symbolMap: any): string => {
    if (valueX6 === 0) return "0.00";
    const value = valueX6 / 1000000; 
    return value.toFixed(symbolMap[assetId]?.priceDecimals || 2);
};

export const formatUSD = (valueX6: number): string => (valueX6 ? (valueX6 / 1000000).toFixed(2) : "0.00");

export const getDisplaySymbol = (assetSymbol: string, assetId: number): string => {
    if (PAIR_MAP[assetId]) return PAIR_MAP[assetId].split('_')[0].toUpperCase() + "/USD";
    const baseSymbol = assetSymbol.split('/')[0];
    return assetId <= 1000 ? `${baseSymbol}/USD` : assetSymbol; 
};

// --- LE HOOK PRINCIPAL ---
export const usePortfolio = () => {
    const { address, isConnected } = useAccount();
    const { data: wsData } = useWebSocket();
    const { configs: assetConfigs } = useAssetConfig(); 

    const [rawTrades, setRawTrades] = useState<any[]>([]);
    const [isLoadingTrades, setIsLoadingTrades] = useState(false);
    const [exposures, setExposures] = useState<any>({});
    const [baseSpreads, setBaseSpreads] = useState<any>({});
    const [liveFundings, setLiveFundings] = useState<any>({});

    const fetchTrades = useCallback(async () => {
        if (!address) return;
        setIsLoadingTrades(true);
        try {
            const resIds = await fetch(`https://api.brokex.trade/trader/${address}/ids?state=all`);
            const { ids } = await resIds.json();
            const detailPromises = ids.map((id: number) => fetch(`https://api.brokex.trade/trade/${id}`).then(r => r.json()));
            const trades = (await Promise.all(detailPromises)).filter(t => !t.error);
            setRawTrades(trades);

            const [expoRes, spreadRes] = await Promise.all([fetch('https://api.brokex.trade/exposures'), fetch('https://api.brokex.trade/spreads/base')]);
            const expoJson = await expoRes.json();
            const spreadJson = await spreadRes.json();
            if (expoJson.success) setExposures(expoJson.data);
            if (spreadJson.success) setBaseSpreads(spreadJson.data);

            const activeAssetIds = Array.from(new Set(trades.filter(t => t.state === 1).map(t => Number(t.assetId))));
            const fundingPromises = activeAssetIds.map(id => fetch(`https://api.brokex.trade/funding/live/${id}`).then(r => r.json()).catch(() => null));
            const fundingResults = await Promise.all(fundingPromises);
            
            const fundingsMap: any = {};
            fundingResults.forEach((res) => { if (res?.success && res.data) fundingsMap[res.data.assetId] = res.data; });
            setLiveFundings(fundingsMap);
        } catch (e) { console.error("Error fetching trades:", e); } 
        finally { setIsLoadingTrades(false); }
    }, [address]);

    useEffect(() => {
        if (isConnected) fetchTrades();
        const interval = setInterval(() => { if (isConnected) fetchTrades(); }, 5000);
        return () => clearInterval(interval);
    }, [fetchTrades, isConnected]);

    const assetSymbolMap = useMemo(() => {
        return assetConfigs.reduce((map, config) => {
            const powerOfTen = Math.round(Math.log10(1000000 / config.tick_size_usd6)); 
            const decimals = Math.max(0, powerOfTen);
            map[config.asset_id] = { 
                symbol: `${config.symbol}/USD`, 
                baseSymbol: config.symbol,     
                priceDecimals: decimals,
                priceStep: 1 / (10 ** decimals),
            };
            return map;
        }, {} as { [id: number]: { symbol: string; baseSymbol: string; priceDecimals: number; priceStep: number } });
    }, [assetConfigs]);

    const assetMap = useMemo(() => {
        const allAssets = getAssetsByCategory(wsData).crypto.concat(
            getAssetsByCategory(wsData).forex, getAssetsByCategory(wsData).commodities,
            getAssetsByCategory(wsData).stocks, getAssetsByCategory(wsData).indices
        );
        return allAssets.reduce((map, asset) => {
            const currentPrice = wsData[asset.pair]?.instruments[0]?.currentPrice;
            map[asset.id] = { currentPrice: currentPrice ? parseFloat(currentPrice) : null, pair: asset.pair };
            return map;
        }, {} as { [id: number]: { currentPrice: number | null; pair: string } });
    }, [wsData]);

    const lists = useMemo(() => {
        const open: any[] = [], pending: any[] = [], closed: any[] = [], cancelled: any[] = [];

        rawTrades.forEach((t) => {
            const kind = getMarketKindFromId(Number(t.assetId));
            const isMarketOpen = kind ? getMarketStatusUTC(kind).isOpen : true;
            const position = {
                id: Number(t.id), asset_id: Number(t.assetId), long_side: Boolean(t.isLong), 
                is_limit: Boolean(t.isLimit), leverage_x: Number(t.leverage), entry_x6: Number(t.openPrice),
                margin_usd6: Number(t.marginUsdc), sl_x6: Number(t.stopLoss), tp_x6: Number(t.takeProfit),
                lots: Number(t.lotSize), closed_lots: Number(t.closedLotSize || 0), created_at: Number(t.openTimestamp),
                target_x6: Number(t.openPrice), state: Number(t.state), closePriceX6: Number(t.closePrice), pnl_usd6: null as number | null
            };

            const assetInfo = assetSymbolMap[position.asset_id];
            const assetWs = assetMap[position.asset_id];
            const assetMultiplier = ASSET_LOT_SIZES[position.asset_id] || 1;
            const remainingLots = position.lots - position.closed_lots;
            const displaySize = remainingLots * assetMultiplier;

            let liqPriceX6 = 0;
            if (position.entry_x6 > 0 && position.leverage_x > 0) {
                liqPriceX6 = position.entry_x6 * (1 + (position.long_side ? -0.9 : 0.9) / position.leverage_x);
            }

            const enriched = {
                ...position,
                assetSymbol: assetInfo ? assetInfo.symbol : `Asset #${position.asset_id}`,
                size: parseFloat(displaySize.toFixed(6)).toString(),
                priceDecimals: assetInfo?.priceDecimals || 2,
                currentPrice: assetWs?.currentPrice ? assetWs.currentPrice.toFixed(assetInfo?.priceDecimals || 2) : '---',
                isMarketOpen, liq_x6: liqPriceX6, calculatedPNL: null as number | null, calculatedROE: null as number | null,
                orderTypeString: position.is_limit ? 'Limit' : 'Stop'
            };

            if (t.state === 1) { // OPEN
                if (assetWs?.currentPrice && position.entry_x6 > 0) {
                    const currentP = assetWs.currentPrice;
                    const entryP = position.entry_x6 / 1000000;
                    const spreadDecimal = calculateExitSpreadDecimal(position.asset_id, position.long_side, position.lots, exposures, baseSpreads);
                    const exitPrice = position.long_side ? currentP - (currentP * spreadDecimal) : currentP + (currentP * spreadDecimal);
                    
                    const rawPnl = displaySize * (exitPrice - entryP) * (position.long_side ? 1 : -1);
                    
                    let fundingFeeUsd = 0;
                    const fundingInfo = liveFundings[position.asset_id];
                    if (fundingInfo && t.fundingIndex) {
                        const liveIdx = BigInt((position.long_side ? fundingInfo.liveLongIndex : fundingInfo.liveShortIndex) || "0");
                        const entryIdx = BigInt(t.fundingIndex || "0");
                        if (liveIdx > entryIdx) fundingFeeUsd = (exitPrice * displaySize) * (Number(liveIdx - entryIdx) / Number(WAD));
                    }

                    enriched.calculatedPNL = rawPnl - fundingFeeUsd;
                    const estimatedMargin = (displaySize * entryP) / position.leverage_x;
                    enriched.calculatedROE = estimatedMargin > 0 ? (enriched.calculatedPNL / estimatedMargin) * 100 : 0;
                }
                open.push(enriched);
            } 
            else if (t.state === 0) pending.push(enriched);
            else if (t.state === 2) { // CLOSED
                const closedDisplaySize = (position.closed_lots > 0 ? position.closed_lots : position.lots) * assetMultiplier;
                if (position.entry_x6 > 0) {
                    const pnl = closedDisplaySize * ((position.closePriceX6 / 1e6) - (position.entry_x6 / 1e6)) * (position.long_side ? 1 : -1);
                    enriched.pnl_usd6 = pnl * 1000000; 
                }
                enriched.size = parseFloat(closedDisplaySize.toFixed(6)).toString();
                closed.push(enriched);
            }
            else if (t.state === 3) cancelled.push(enriched);
        });

        const sortDesc = (a: any, b: any) => b.created_at - a.created_at;
        return { 
            openPositions: open.sort(sortDesc), 
            pendingOrders: pending.sort(sortDesc), 
            closedPositions: closed.sort(sortDesc), 
            cancelledOrders: cancelled.sort(sortDesc) 
        };
    }, [rawTrades, assetMap, assetSymbolMap, exposures, baseSpreads, liveFundings]);

    return { ...lists, isLoadingTrades, fetchTrades, assetSymbolMap };
};
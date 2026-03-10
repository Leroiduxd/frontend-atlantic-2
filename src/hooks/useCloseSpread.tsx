import { useState, useEffect } from 'react';

// Constante WAD pour simuler 1e18 en BigInt
const WAD = 1000000000000000000n;

export function useCloseSpread(assetId, isLongTrade, lotSize) {
  const [spreadWad, setSpreadWad] = useState("0");
  const [spreadPercent, setSpreadPercent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Si l'id ou la taille n'est pas valide, on ne fait rien
    if (assetId === undefined || !lotSize || lotSize <= 0) return;

    let isMounted = true;

    const fetchAndCalculate = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch des deux APIs en parallèle pour aller plus vite
        const [expoRes, spreadRes] = await Promise.all([
          fetch('https://api.brokex.trade/exposures'),
          fetch('https://api.brokex.trade/spreads/base')
        ]);

        const expoJson = await expoRes.json();
        const spreadJson = await spreadRes.json();

        if (!isMounted) return;

        // 2. Extraction sécurisée (fallback à "0" si l'asset n'est pas dans l'API)
        const assetExpo = expoJson.data[assetId.toString()] || { longLots: "0", shortLots: "0" };
        const baseSpreadStr = spreadJson.data[assetId.toString()] || "0";

        // Conversion en BigInt pour la précision WAD
        const base = BigInt(baseSpreadStr);
        let L = BigInt(assetExpo.longLots || "0");
        let S = BigInt(assetExpo.shortLots || "0");
        const size = BigInt(Math.floor(lotSize));

        // 3. Simulation de la fermeture sur l'exposition
        if (isLongTrade) {
          L -= size;
        } else {
          S -= size;
        }

        // Sécurité anti-négatif
        if (L < 0n) L = 0n;
        if (S < 0n) S = 0n;

        // 4. Calcul du déséquilibre
        const numerator = L > S ? L - S : S - L;
        const denominator = L + S + 2n;

        // S'il n'y a plus aucun trade, on retourne le spread de base
        if (denominator === 0n) {
          setSpreadWad(base.toString());
          setSpreadPercent((Number(base) / Number(WAD)) * 100);
          return;
        }

        // Logique quadratique WAD
        const r = (numerator * WAD) / denominator;
        const p = (r * r) / WAD;

        // 5. Règle de Dominance inversée (car on ferme un trade)
        // Fermer un Long aggrave la situation si les Shorts dominent déjà (S > L)
        // Fermer un Short aggrave la situation si les Longs dominent déjà (L > S)
        const dominant = (S > L && isLongTrade) || (L > S && !isLongTrade);

        // 6. Application de la pénalité si dominant
        const finalSpreadWad = dominant ? (base * (WAD + 3n * p)) / WAD : base;

        // Mise à jour du state (WAD brut + format lisible en %)
        setSpreadWad(finalSpreadWad.toString());
        setSpreadPercent((Number(finalSpreadWad) / Number(WAD)) * 100);

      } catch (error) {
        console.error("Erreur API Brokex lors du calcul du spread:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAndCalculate();

    return () => { isMounted = false; };
  }, [assetId, isLongTrade, lotSize]);

  return { spreadWad, spreadPercent, isLoading };
}
import { useState, useEffect } from 'react';

interface ChartData {
  time: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export const useChartData = (pair: number = 0, interval: string = "300") => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        // On remet le loading à true à chaque changement de paire
        setLoading(true); 
        
        const response = await fetch(`https://backend.brokex.trade/history?pair=${pair}&interval=${interval}`);
        const result = await response.json();
        
        if (isMounted) {
          // 1. ON INTERCEPTE L'ERREUR SUPRA ICI
          if (result && result.error) {
            console.warn("L'API a renvoyé une erreur (ex: Supra) :", result.error);
            setData([]); // On donne un tableau vide pour empêcher le crash !
          } 
          // 2. Si c'est bien un tableau (crypto), on l'enregistre
          else if (Array.isArray(result)) {
            setData(result);
          } 
          // 3. Sécurité supplémentaire si c'est autre chose
          else {
            setData([]);
          }
        }
      } catch (error) {
        console.error('Erreur lors du fetch des données:', error);
        if (isMounted) setData([]); // En cas de crash réseau, on met un tableau vide
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pair, interval]);

  return { data, loading };
};
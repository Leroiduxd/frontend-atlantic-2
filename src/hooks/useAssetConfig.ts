import { useState, useEffect } from 'react';

export interface AssetConfig {
  asset_id: number;
  symbol: string;
  tick_size_usd6: number;
  lot_num: number;
  lot_den: number;
}

export const useAssetConfig = () => {
  const [configs, setConfigs] = useState<AssetConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await fetch('https://api.brokex.trade/assets');
        const data = await response.json();
        setConfigs(data);
      } catch (error) {
        console.error('Failed to fetch asset configs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  const getConfigById = (assetId: number): AssetConfig | undefined => {
    return configs.find(c => c.asset_id === assetId);
  };

  const convertDisplayToLots = (displayValue: number, assetId: number): number => {
    const config = getConfigById(assetId);
    if (!config) return displayValue;
    
    // displayValue * lot_den / lot_num = actual lots
    return Math.round(displayValue * config.lot_den / config.lot_num);
  };

  const convertLotsToDisplay = (lots: number, assetId: number): number => {
    const config = getConfigById(assetId);
    if (!config) return lots;
    
    // lots * lot_num / lot_den = display value
    return lots * config.lot_num / config.lot_den;
  };

  return {
    configs,
    loading,
    getConfigById,
    convertDisplayToLots,
    convertLotsToDisplay,
  };
};

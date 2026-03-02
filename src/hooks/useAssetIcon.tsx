"use client";

import React, { useEffect } from 'react';

export const ASSET_ICONS_BY_ID: Record<number, string> = {
  0: 'cryptocurrency:btc',
  1: 'cryptocurrency:eth',
  2: 'cryptocurrency:link',
  3: 'cryptocurrency:doge',
  5: 'cryptocurrency:avax',
  10: 'cryptocurrency:sol',
  14: 'cryptocurrency:xrp',
  15: 'cryptocurrency:trx',
  16: 'cryptocurrency:ada',
  90: 'simple-icons:sui',
  5000: 'emojione-monotone:flag-for-european-union',
  5001: 'emojione-monotone:flag-for-japan',
  5002: 'emojione-monotone:flag-for-united-kingdom',
  5010: 'emojione-monotone:flag-for-australia',
  5011: 'emojione-monotone:flag-for-canada',
  5012: 'mdi:swiss-cross-box',
  5013: 'emojione-monotone:flag-for-new-zealand',
  5500: 'streamline-plump:gold-remix',
  5501: 'streamline-plump:gold-solid',
  5503: 'mdi:barrel',
  6000: 'simple-icons:tesla',
  6001: 'simple-icons:microsoft',
  6002: 'simple-icons:nvidia',
  6003: 'simple-icons:google',
  6004: 'simple-icons:apple',
  6005: 'simple-icons:amazon',
  6006: 'simple-icons:meta',
  6009: 'simple-icons:intel',
  6010: 'simple-icons:coinbase',
  6011: 'arcticons:gamestop',
  6034: 'simple-icons:nike',
  6038: 'simple-icons:oracle',
  6059: 'simple-icons:cocacola',
  6066: 'simple-icons:ibm',
  6068: 'simple-icons:mcdonalds',
  6113: 'emojione-monotone:flag-for-united-states',
  6114: 'emojione-monotone:flag-for-united-states',
  6115: 'emojione-monotone:flag-for-united-states',
};

export const getIconString = (assetId: number) => {
  return ASSET_ICONS_BY_ID[assetId] || 'lucide:help-circle';
};

// Le composant est maintenant stable et ne se déchargera plus
export const AssetIcon = ({ 
  assetId, 
  isDark, 
  size = "24px", 
  className = "" 
}: { 
  assetId: number; 
  isDark: boolean; 
  size?: string; 
  className?: string; 
}) => {
  useEffect(() => {
    if (!document.getElementById('iconify-script')) {
      const script = document.createElement('script');
      script.id = 'iconify-script';
      script.src = "https://code.iconify.design/3/3.1.1/iconify.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const iconStr = getIconString(assetId);

  return (
    <div 
      className={`flex items-center justify-center transition-all duration-300 ${className}`}
      style={{ filter: isDark ? 'brightness(0) invert(1)' : 'brightness(0)' }}
    >
      <span 
        className="iconify" 
        data-icon={iconStr} 
        style={{ width: size, height: size, display: 'block' }} 
      />
    </div>
  );
};
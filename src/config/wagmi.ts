import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, http } from 'viem';

export const customChain = defineChain({
  id: 688689,
  name: 'Custom Trading Chain',
  nativeCurrency: { name: 'Custom Token', symbol: 'PHRS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://atlantic.dplabs-internal.com'] },
    public:  { http: ['https://atlantic.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://atlantic.pharosscan.xyz' },
  },
});

export const config = getDefaultConfig({
  appName: 'Trading Dashboard',
  projectId: 'd599add7e84b45278fada8bf28c54ac7',
  chains: [customChain],
  transports: {
    [customChain.id]: http('https://atlantic.dplabs-internal.com'),
  },
  ssr: false,
});

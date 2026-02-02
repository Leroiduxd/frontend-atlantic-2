import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { config } from './config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import { SpiceFlowProvider } from "@spicenet-io/spiceflow-ui";
import "@spicenet-io/spiceflow-ui/styles.css";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// 👇 1. AJOUTE CET IMPORT (le fichier que tu as créé tout à l'heure)
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}> 
    <WagmiProvider config={config}> 
      <RainbowKitProvider> 
        
        {/* 👇 2. INSERE LE THEME PROVIDER ICI */}
        {/* Cela permet d'injecter la classe 'dark' ou 'light' dans ton HTML */}
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme" attribute="class">
          
          <SpiceFlowProvider 
            provider="privy"
            privyAppId="cmebl077a0160l40a7xpxcv84"
            supportedChainIds={[84532, 688689, 5115, 421614, 11155111]}
            nativeChainId={688689}
            nonEip7702Mode={true}
          >
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </SpiceFlowProvider>

        </ThemeProvider>
        {/* 👆 FIN DU THEME PROVIDER */}

      </RainbowKitProvider>
    </WagmiProvider>
  </QueryClientProvider>
);

export default App;
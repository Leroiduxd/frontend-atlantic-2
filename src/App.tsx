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

const queryClient = new QueryClient();

const App = () => (
  // 🛑 1. QueryClientProvider (Doit être en haut pour le cache)
  <QueryClientProvider client={queryClient}> 
    {/* 🛑 2. WagmiProvider (Doit être en dessous de QueryClient) */}
    <WagmiProvider config={config}> 
      {/* 🛑 3. RainbowKitProvider (Doit être en dessous de Wagmi) */}
      <RainbowKitProvider> 
        <SpiceFlowProvider 
          provider="privy"
          privyAppId="cmebl077a0160l40a7xpxcv84"
          supportedChainIds={[84532, 688689,5115 ,421614, 11155111]}
          nonEip7702Mode={true}
        >
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SpiceFlowProvider>
      </RainbowKitProvider>
    </WagmiProvider>
  </QueryClientProvider>
);

export default App;
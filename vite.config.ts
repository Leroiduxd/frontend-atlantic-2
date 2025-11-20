import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // alias -> src
    },
    dedupe: [
      'viem',
      'wagmi',
      '@wagmi/core',
      '@wagmi/connectors',
      'porto',
      'react',
      'react-dom',
      '@tanstack/react-query',
    ],
  },
  optimizeDeps: {
    include: [
      'viem',
      'wagmi',
      '@wagmi/core',
      '@wagmi/connectors',
      'porto',
    ],
    exclude: ['@spicenet-io/spicenet-sdk'],
  },
}));

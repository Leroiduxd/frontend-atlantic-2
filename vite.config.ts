import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills"; // <-- 1. Import du plugin ajouté ici

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    nodePolyfills(), // <-- 2. Plugin ajouté ici dans le tableau
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // alias -> src
    },
    dedupe: [
      'viem',
      'wagmi',
      '@wagmi/core',
      '@wagmi/connectors',
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
    ],
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
}));
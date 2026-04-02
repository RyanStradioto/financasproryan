import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('recharts')) return 'recharts';
          if (id.includes('react-hook-form')) return 'react-hook-form';
          if (id.includes('@tanstack/react-query')) return 'tanstack-react-query';
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('@radix-ui')) return 'radix-ui';
          if (id.includes('node_modules')) return 'vendors';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/shodan-proxy': {
        target: 'https://api.shodan.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shodan-proxy/, ''),
      },
      '/whois-proxy': {
        target: 'https://rdap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/whois-proxy/, ''),
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tooltip'],
          utils: ['lucide-react', 'react-markdown'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));

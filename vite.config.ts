import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: ['es2020', 'safari14'],
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Tách các chunk lớn để tránh bundle 2.7MB
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark')) {
              return 'vendor-markdown';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-charts';
            }
            // web-ifc và three là lazy-loaded — không split thêm để tránh conflict
            if (id.includes('node_modules/web-ifc') || id.includes('node_modules/three')) {
              return 'vendor-bim';
            }
            if (id.includes('node_modules/@google/generative-ai')) {
              return 'vendor-gemini';
            }
          },
        },
      },
    },
    optimizeDeps: {
      // web-ifc dùng WASM + worker — exclude khỏi pre-bundle để tránh conflict
      exclude: ['web-ifc', 'web-ifc-viewer'],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    // Cho phép serve WASM files từ node_modules
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        // Required cho SharedArrayBuffer (web-ifc WASM multithreading)
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy':   'same-origin',
      },
      fs: {
        // Cho phép serve files từ node_modules (web-ifc WASM)
        allow: ['..'],
      },
    },
    // Assetsinclude WASM
    assetsInclude: ['**/*.wasm'],
  };
});

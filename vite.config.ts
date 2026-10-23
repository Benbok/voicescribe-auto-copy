import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    return {
      envPrefix: isProduction ? 'VOICE_SCRIBE_PUBLIC_' : 'VITE_',
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'lucide-react', '@google/genai'],
        force: true,
      },
      plugins: [react()],
      build: {
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            manualChunks: undefined,
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(isProduction ? '' : env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(isProduction ? '' : env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

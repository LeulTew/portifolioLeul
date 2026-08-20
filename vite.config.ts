/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) {
            return 'three-core';
          }
          // React must be co-located with R3F — R3F calls useLayoutEffect
          // at module init time, so React must be in the same chunk to
          // guarantee it is available before R3F executes.
          if (
            id.includes('node_modules/@react-three/fiber/') ||
            id.includes('node_modules/@react-three/drei/') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'r3f-vendor';
          }
          if (id.includes('node_modules/framer-motion/') || id.includes('node_modules/gsap/') || id.includes('node_modules/animejs/')) {
            return 'animation-vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'framer-motion',
      'gsap'
    ],
    esbuildOptions: {
      target: 'esnext',
    }
  },
  server: process.env.VITEST ? undefined : {
    host: '0.0.0.0',
    port: 8080,
    strictPort: false,
    fs: {
      strict: false,
      allow: ['..']
    }
  },
});
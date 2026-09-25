/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'path';

/**
 * The deployed site-wide headers, for `vite preview` only. Vercel consumes
 * vercel.json itself and does not promise it is readable while the build runs,
 * so the production build never reads it.
 */
function deploymentHeaders(): Record<string, string> {
  const deployment = JSON.parse(readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  return Object.fromEntries(
    deployment.headers
      .filter(rule => rule.source === '/(.*)')
      .flatMap(rule => rule.headers.map(({ key, value }) => [key, value])),
  );
}

export default defineConfig(({ isPreview }) => ({
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
          // Keep Vite's shared import helper out of R3F so routing never loads the scene.
          if (id === '\0vite/preload-helper.js') return 'preload-helper';
          if (id.includes('node_modules/three/')) {
            return 'three-core';
          }
          // React has its own chunk, which the DOM page and R3F both import, so a
          // page without WebGL loads React without the renderer (round 10,
          // TECH-029). ES module order still evaluates React before R3F.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@react-three/fiber/') || id.includes('node_modules/@react-three/drei/')) {
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
  server: {
    host: '127.0.0.1',
    port: 8080,
    strictPort: false,
    fs: {
      strict: true,
      allow: [path.resolve(__dirname)]
    }
  },
  // Exercise the deployed policy in preview, not in development's inline HMR runtime.
  preview: {
    host: '127.0.0.1',
    ...(isPreview ? { headers: deploymentHeaders() } : {}),
  },
}));
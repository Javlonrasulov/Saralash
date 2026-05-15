import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        /** `.tsx` avval — aks holda `App.js` kabi eski kompil qoldiqlar `.tsx`dan ustun turadi */
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.mts', '.json'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        dedupe: ['react', 'react-dom'],
    },
    server: {
        port: 5174,
        proxy: {
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            },
        },
    },
});

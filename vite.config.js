import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/sstv-toolkit/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
});

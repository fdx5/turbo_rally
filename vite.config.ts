import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        turntable: resolve(__dirname, 'dev/turntable.html'),
        race: resolve(__dirname, 'dev/race.html'),
      },
    },
  },
  server: { port: 5173, host: true },
});

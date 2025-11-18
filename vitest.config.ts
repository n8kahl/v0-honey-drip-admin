import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    exclude: [
      'e2e/**',
      '**/node_modules/**',
      '**/dist/**',
      // Exclude Massive integration-heavy tests by default; run them separately when needed
      'src/lib/massive/**/__tests__/**',
      // Re-enabled for TP/SL flow verification: 'src/lib/riskEngine/**/__tests__/**'
    ],
  },
});

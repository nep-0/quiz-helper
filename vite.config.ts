import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/quiz-helper/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node'
  }
}));

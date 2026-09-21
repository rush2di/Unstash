import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolve = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `expo-crypto` is a native module; Node's crypto provides the one function used.
      'expo-crypto': resolve('./tests/stubs/expo-crypto.ts'),
      'expo-file-system': resolve('./tests/stubs/expo-file-system.ts'),
      '@': resolve('./src'),
    },
  },
});

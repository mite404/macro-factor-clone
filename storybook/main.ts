import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const waSqlite = join(dirname(createRequire(import.meta.url).resolve('expo-sqlite/package.json')), 'web/wa-sqlite');

const config: StorybookConfig = {
  stories: ['./**/*.stories.tsx'],
  framework: '@storybook/react-native-web-vite',
  core: { disableTelemetry: true },
  viteFinal: (vite) => ({
    ...vite,
    plugins: [
      ...(vite.plugins ?? []),
      {
        // expo-sqlite's wa-sqlite build is a script that Metro imports through CommonJS interop.
        name: 'wa-sqlite-esm',
        transform: (code, id) => (id === join(waSqlite, 'wa-sqlite.js') ? `${code}\nexport default Module;` : undefined),
      },
    ],
    // expo-modules-core's build keeps type-only imports as value imports; Metro tolerates them.
    optimizeDeps: { ...vite.optimizeDeps, rolldownOptions: { ...vite.optimizeDeps?.rolldownOptions, shimMissingExports: true } },
    resolve: {
      ...vite.resolve,
      alias: [
        { find: /^expo-sqlite$/, replacement: join(import.meta.dirname, 'sqlite.tsx') },
        { find: /^expo-camera$/, replacement: join(import.meta.dirname, 'camera.tsx') },
        { find: /^wa-sqlite$/, replacement: join(waSqlite, 'sqlite-api.js') },
        { find: 'wa-sqlite/dist/wa-sqlite.mjs', replacement: join(waSqlite, 'wa-sqlite.js') },
        { find: 'wa-sqlite/src/examples/MemoryVFS.js', replacement: join(waSqlite, 'MemoryVFS.js') },
        { find: /^wa-sqlite\/wa-sqlite\.wasm/, replacement: join(waSqlite, 'wa-sqlite.wasm') },
      ],
    },
  }),
};

export default config;

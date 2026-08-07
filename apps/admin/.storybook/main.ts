import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';

const config = {
  addons: [],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: [{ from: '../../web/public/fonts', to: '/fonts' }],
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    define: {
      ...viteConfig.define,
      __dirname: JSON.stringify('/'),
    },
    plugins: [...(viteConfig.plugins ?? []), react()],
  }),
} satisfies StorybookConfig;

export default config;

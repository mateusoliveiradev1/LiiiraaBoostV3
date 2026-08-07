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
  stories: ['../src/testing/**/*.stories.@(ts|tsx)'],
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), react()],
  }),
} satisfies StorybookConfig;

export default config;

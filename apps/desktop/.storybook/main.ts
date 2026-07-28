import type { StorybookConfig } from '@storybook/react-vite';

const config = {
  addons: [],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  stories: ['../src/**/*.stories.@(ts|tsx)'],
} satisfies StorybookConfig;

export default config;

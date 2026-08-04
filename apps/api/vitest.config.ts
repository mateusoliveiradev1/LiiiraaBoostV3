import { defineConfig } from 'vitest/config';

const unitPattern = 'src/**/*.test.ts';
const postgresPattern = 'src/**/*.postgres.test.ts';

export default defineConfig(({ mode }) => {
  const postgresMode = mode === 'postgres';

  return {
    test: {
      exclude: postgresMode ? [] : [postgresPattern],
      include: [postgresMode ? postgresPattern : unitPattern],
      passWithNoTests: postgresMode,
    },
  };
});

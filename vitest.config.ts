import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    // Agent worktrees live under .claude/worktrees/<id>/ and carry a full copy
    // of src, including every test file. A bare `exclude` replaces Vitest
    // defaults; spread them and add the worktree root.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

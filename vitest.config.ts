import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    // Agent worktrees live under .claude/worktrees/<id>/ and carry a full copy
    // of src, including every test file. Without this, `npm run check` collects
    // them alongside the real tree — doubling the suite and failing on the
    // sibling's unresolved imports, which reads as a regression in your own
    // branch. CI never sees it (clean checkout), so it only ever bites locally.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

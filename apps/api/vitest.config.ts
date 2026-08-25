import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // An in-memory MongoDB has to download and boot on first run, and these are
    // integration tests against a real database rather than unit tests.
    testTimeout: 30_000,
    // Generous: the very first run downloads a ~600 MB MongoDB binary, which is
    // then cached for every subsequent run.
    hookTimeout: 600_000,
    // Run in a single forked process so one in-memory mongod is shared across
    // test files rather than booted per worker.
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
});

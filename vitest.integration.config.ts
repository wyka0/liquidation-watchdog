import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 240_000,
    hookTimeout: 240_000,
    maxWorkers: 1,
    fileParallelism: false
  }
});

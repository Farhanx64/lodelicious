import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@payload-config", replacement: path.resolve(root, "payload.config.ts") },
      { find: /^@\/(.*)$/, replacement: `${root}/$1` },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Each test file gets its own throwaway SQLite database (see tests/setup-env.ts).
    setupFiles: ["tests/setup-env.ts"],
    pool: "forks",
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

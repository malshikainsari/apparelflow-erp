import { defineConfig } from "vitest/config";
import path from "node:path";

const src = path.resolve(process.cwd(), "src");

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${src}/` }],
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60000, // remote Neon DB
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
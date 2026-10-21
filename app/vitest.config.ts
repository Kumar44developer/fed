import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Every test file gets its own isolated in-memory SQLite database.
    env: { INSTAFEED_DB_PATH: ":memory:" },
  },
});

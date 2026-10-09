import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/test/test-db-url.js";
import { testKeyEnv } from "./src/test/test-keys.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false, // tests share one database
    globalSetup: ["./src/test/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl(),
      ...testKeyEnv(),
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    dedupe: ["graphql"]
  },
  test: {
    environment: "node",
    globals: false,
    pool: "forks",
    server: {
      deps: {
        inline: [/graphql/]
      }
    },
    setupFiles: ["./tests/setup.ts"],
    env: {
      DATABASE_URL: "postgresql://devconnectql_user:devconnectql_pass@localhost:5432/devconnectql_test_db?schema=public",
      JWT_SECRET: "test_jwt_secret_for_vitest_do_not_use_in_production",
      NODE_ENV: "test"
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/server.ts"]
    }
  }
});

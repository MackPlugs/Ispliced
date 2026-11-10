import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/ui/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "ui",
          include: ["tests/ui/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/setup.ts"],
        },
      },
    ],
  },
});

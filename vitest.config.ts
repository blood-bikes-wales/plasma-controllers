import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/build/**",
      "**/.react-router/**",
      "**/app/components/ui/**",
    ],
  },
});

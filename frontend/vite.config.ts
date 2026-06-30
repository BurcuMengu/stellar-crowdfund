/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  // GitHub Pages serves from /<repo>/; Netlify/Vercel serve from root.
  base: process.env.GITHUB_PAGES ? "/stellar-crowdfund/" : "/",
  plugins: [
    react(),
    // @stellar/stellar-sdk and Stellar Wallets Kit (via @near-js/randombytes)
    // expect Node globals (`global`, `Buffer`, `process`) that the browser
    // doesn't provide. Polyfill them so modules load at runtime.
    nodePolyfills({
      globals: { global: true, Buffer: true, process: true },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});

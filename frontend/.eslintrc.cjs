module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "vite.config.ts"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    // We intentionally colocate hooks (useWallet/useToast) with their
    // providers, and a couple of small helpers with their components.
    "react-refresh/only-export-components": "off",
    "@typescript-eslint/no-explicit-any": "off",
  },
};

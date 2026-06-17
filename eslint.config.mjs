// ESLint 9 flat config for Next.js 16
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // Apply to all TS/TSX source files
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // TypeScript handles undefined variables far better than no-undef;
      // keeping no-undef on TS files causes false positives on React/NodeJS types.
      "no-undef": "off",

      // React 17+ new JSX transform — no need to import React for JSX
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",

      // React hooks — these are real bugs, keep as errors
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Suppress pre-existing style patterns — treat as warnings so new violations are visible
      "no-unused-vars": "off", // handled by @typescript-eslint/no-unused-vars
      "no-empty": "warn",
      "no-constant-binary-expression": "warn",
      "no-unsafe-finally": "warn",
      "no-console": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "*.config.mjs",
      "*.config.js",
      "src/generated/**",
    ],
  },
];

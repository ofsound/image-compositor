import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const testGlobals = {
  ...globals.browser,
  ...globals.node,
  beforeAll: "readonly",
  beforeEach: "readonly",
  afterAll: "readonly",
  afterEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  test: "readonly",
  vi: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dist-electron/**",
      "node_modules/**",
      "coverage/**",
      "release/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "tests/**/*.ts",
      "tests/**/*.tsx",
    ],
    languageOptions: {
      globals: testGlobals,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
);

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import jsdocPlugin from "eslint-plugin-jsdoc";
import eslintCommentsPlugin from "eslint-plugin-eslint-comments";

const nextRequiredDefaultExportFiles = [
  "src/app/**/page.tsx",
  "src/app/**/layout.tsx",
  "src/app/**/loading.tsx",
  "src/app/**/error.tsx",
  "src/app/**/not-found.tsx",
  "src/app/**/template.tsx",
  "src/app/**/default.tsx",
  "next.config.ts",
];

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "out/**",
      "*.config.{js,mjs,cjs,ts,mts,cts}",
      "eslint.config.mjs",
      "prettier.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...nextVitals,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      jsdoc: jsdocPlugin,
      "eslint-comments": eslintCommentsPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 20,
        },
      ],
      "eslint-comments/disable-enable-pair": ["error", { allowWholeFile: false }],
      "eslint-comments/no-unlimited-disable": "error",
      "eslint-comments/require-description": ["error", { ignore: [] }],
      "import/no-cycle": ["error", { maxDepth: 1 }],
      "import/no-default-export": "error",
      "import/no-internal-modules": [
        "error",
        {
          allow: [
            "firebase/app",
            "firebase/auth",
            "@/app/**",
            "@/shared/**",
            "@/features/*",
            "@/entities/*",
            "@/widgets/*",
            "@/pages/*",
            "@testing-library/jest-dom/vitest",
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/features/*/*", "@/entities/*/*", "@/widgets/*/*", "@/pages/*/*"],
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CallExpression[callee.name='useEffect'] CallExpression[callee.name=/^set[A-Z]/]",
          message:
            "派生状態の同期目的での useEffect 内 setState は避け、計算値やイベント起点の更新に置き換えてください。",
        },
      ],
    },
  },
  {
    files: nextRequiredDefaultExportFiles,
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    files: [
      "src/{widgets,features,entities,pages}/**/index.{ts,tsx}",
      "src/**/*/api/**/*.{ts,tsx}",
    ],
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            ClassExpression: false,
            FunctionDeclaration: true,
            FunctionExpression: false,
            MethodDefinition: false,
          },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportDefaultDeclaration > FunctionDeclaration",
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "import/no-internal-modules": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
);

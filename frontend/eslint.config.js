import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**", "output/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off",
      "import/first": "off",
      "import/newline-after-import": "off",
      "import/no-duplicates": "off",
    },
  },
  {
    files: [
      "src/pages/GoodsIssuePage.tsx",
      "src/pages/StockTransferPage.tsx",
      "src/pages/ShippingPage.tsx",
      "src/pages/PurchasingPage.tsx",
      "src/pages/InterWarehouseTransferPage.tsx",
      "src/pages/ReturnsPage.tsx",
      "src/pages/ReportsPage.tsx",
      "src/components/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              allowTypeImports: true,
              message: "Use frontend/src/services/* instead of direct axios calls in pages/components.",
            },
          ],
          patterns: [
            {
              group: ["axios/*"],
              allowTypeImports: true,
              message: "Use frontend/src/services/* instead of direct axios calls in pages/components.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "Use frontend/src/services/* instead of direct fetch calls in pages/components.",
        },
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='fetch']",
          message: "Use frontend/src/services/* instead of direct fetch calls in pages/components.",
        },
      ],
    },
  },
  {
    files: [
      "src/pages/ProductFormPage.tsx",
      "src/pages/GoodsReceiptPage.tsx",
      "src/pages/GoodsIssuePage.tsx",
      "src/pages/StockTransferPage.tsx",
      "src/pages/ShippingPage.tsx",
      "src/pages/PurchasingPage.tsx",
      "src/pages/InterWarehouseTransferPage.tsx",
      "src/pages/ReturnsPage.tsx",
      "src/pages/ReportsPage.tsx",
      "src/pages/**/*Workspace.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  eslintConfigPrettier
);

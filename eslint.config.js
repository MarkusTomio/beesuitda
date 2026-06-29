/**
 * ESLint configuration.
 *
 * The lint script uses this file to catch common JavaScript, React Hook, and
 * Vite/React-refresh mistakes before the dashboard is published. It supports
 * the source files used by App.jsx and the data modules.
 */
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

// ESLint checks the JavaScript/React code for common mistakes before release.
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]);

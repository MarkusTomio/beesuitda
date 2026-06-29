/**
 * Vite build configuration.
 *
 * Vite runs the local development server and creates the production bundle for
 * the React dashboard. The /beesuitda/ base path keeps built asset URLs correct
 * when the dashboard is deployed below that project path.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite prepares the React dashboard for local development and production builds.
export default defineConfig({
  plugins: [react()],
  base: "/beesuitda/",
});

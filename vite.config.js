import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: true,
    __EXPERIMENTAL__: true,
    __PROFILE__: true,
  },
  resolve: {
    alias: {
      react: path.posix.resolve("src/react/packages/react"),
      "react-dom": path.posix.resolve("src/react/packages/react-dom"),
      "react-dom-bindings": path.posix.resolve(
        "src/react/packages/react-dom-bindings"
      ),
      "react-reconciler": path.posix.resolve(
        "src/react/packages/react-reconciler"
      ),
      scheduler: path.posix.resolve("src/react/packages/scheduler"),
      shared: path.posix.resolve("src/react/packages/shared"),
    },
  },
});

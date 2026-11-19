import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [{
    name: "show-project-folder",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        server.config.logger.info(`\n  AquaMonitor — pasta servida: ${server.config.root}\n`);
      });
    },
  }],
  server: { strictPort: true, fs: { allow: [".."] } },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});

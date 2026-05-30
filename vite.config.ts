// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "src/server.ts" },
  },
  vite: {
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true, // Nécessaire pour certains environnements Docker/WSL2
      watch: {
        usePolling: true,
      },
      hmr: {
        clientPort: 3000,
      },
    },
    optimizeDeps: {
      // On laisse Vite gérer l'optimisation automatiquement pour éviter les erreurs d'exports
      include: ['recharts', 'lucide-react', 'date-fns'],
      entries: ['./src/entry-client.tsx', './src/routeTree.gen.ts'],
    },
    resolve: {
      alias: {
        'node:async_hooks': path.resolve(process.cwd(), 'node_modules', 'unenv', 'dist', 'runtime', 'node', 'async_hooks.mjs'),
      },
    },
    ssr: {
      noExternal: [
        '@tanstack/react-start', 
        '@tanstack/react-router', 
        'ts-invariant', 
        'lucide-react',
        'recharts'
      ],
    },
  },
});

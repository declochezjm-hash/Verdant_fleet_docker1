// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "path";
import { verduraChatApiPlugin } from "./vite-plugin-verdura-chat";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "src/server.ts" },
  },
  vite: {
    plugins: [verduraChatApiPlugin()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      watch: {
        usePolling: true,
        interval: process.env.DOCKER ? 2000 : 1000,
        ignored: [
          "**/.git/**",
          "**/src/routeTree.gen.ts",
        ],
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        clientPort: 3000,
      },
    },
    optimizeDeps: {
      // Force l'inclusion de mapbox-gl pour éviter les erreurs de type MIME dans Docker
      include: ['recharts', 'lucide-react', 'date-fns', 'mapbox-gl'],
      exclude: ['@cursor/sdk'],
      entries: ['./src/entry-client.tsx'],
    },
    resolve: {
      alias: {
        'node:async_hooks': path.resolve(process.cwd(), 'node_modules', 'unenv', 'dist', 'runtime', 'node', 'async_hooks.mjs'),
      },
    },
    ssr: {
      external: ['@cursor/sdk'],
      noExternal: [
        '@tanstack/react-start', 
        '@tanstack/react-router', 
        'ts-invariant', 
        'lucide-react',
        'recharts',
        'mapbox-gl'
      ],
    },
  },
});

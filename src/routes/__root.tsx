import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  Scripts,
  ScrollRestoration,
} from "@tanstack/react-router";
import { Suspense, lazy, useState, useEffect } from "react";

// Désactivé temporairement TanStackRouterDevtools car l'import cause des erreurs
// const TanStackRouterDevtools = () => null;

import { AuthProvider } from "@/lib/auth-context";
// Importation manquante
// Importations directes supprimées car les composants sont lazy-chargés
import { Menu, X, Loader2 } from "lucide-react";
// Lazy load Sidebar, RoleSwitcher et Toaster avec Suspense
// Utilisation d'une fonction factory pour éviter les problèmes SSR
const LazySidebar = lazy(() => import("@/components/views/sidebar").then(m => ({ default: m.Sidebar })));
const LazyRoleSwitcher = lazy(() => import("@/components/role-switcher").then(m => ({ default: m.RoleSwitcher })));
const LazyToaster = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
import { Button } from "@/components/ui/button";


import appCss from "../styles.css?url";

// Diagnostic de survie
if (typeof window !== 'undefined') {
  console.log("[Root Diagnostic] Verification des composants au chargement du module:", {
    AuthProvider: !!AuthProvider,
    LazySidebar: !!LazySidebar,
  });
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page introuvable.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // Détecter si c'est une erreur de chargement de module dynamique (Vite/Webpack)
  const isChunkError =
    error.message.includes("fetch") ||
    error.message.includes("dynamically imported module") ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Failed to fetch dynamically imported module");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">
          {isChunkError ? "Session expirée ou mise à jour" : "Une erreur est survenue"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkError
            ? "Une nouvelle version ou un changement de configuration nécessite un rechargement."
            : error.message}
        </p>
        <button
          onClick={() => { isChunkError ? window.location.reload() : (router.invalidate(), reset()); }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {isChunkError ? "Recharger la page" : "Réessayer"}
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Verdura — Gestion espaces verts" },
      { name: "description", content: "Application de gestion full-stack pour services d'espaces verts : planning, stocks phytosanitaires, parc matériel, comptabilité analytique." },
      { property: "og:title", content: "Verdura — Gestion espaces verts" },
      { name: "twitter:title", content: "Verdura — Gestion espaces verts" },
      { property: "og:description", content: "Application de gestion full-stack pour services d'espaces verts : planning, stocks phytosanitaires, parc matériel, comptabilité analytique." },
      { name: "twitter:description", content: "Application de gestion full-stack pour services d'espaces verts : planning, stocks phytosanitaires, parc matériel, comptabilité analytique." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c857ed4d-0b4b-41e6-80c4-700aa9dc0574/id-preview-427019b6--acc191bd-8586-43d5-9022-4e20cf7eb736.lovable.app-1778152200622.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c857ed4d-0b4b-41e6-80c4-700aa9dc0574/id-preview-427019b6--acc191bd-8586-43d5-9022-4e20cf7eb736.lovable.app-1778152200622.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // TanStack Start gère déjà les balises html/body automatiquement
  return <>{children}</>;
}

function RootComponent() {
  const context = Route.useRouteContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Diagnostic de survie
  if (typeof window !== 'undefined' && !mounted) {
    console.log("[Root Diagnostic] Verification des composants au rendu:", {
      AuthProvider: !!AuthProvider,
      LazySidebar: !!LazySidebar,
    });
  }

  // Empêche le mismatch Desktop/Mobile lors du premier rendu SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sécurité si le contexte n'est pas encore prêt (évite la page blanche)
  if (!context?.queryClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={context.queryClient}>
      <AuthProvider>
        <div className="flex min-h-screen w-full bg-background">
          {/* Sidebar - toujours visible sur desktop */}
          <div className="hidden md:flex h-full w-64 flex-col">
            {mounted && (
              <Suspense fallback={null}>
                <LazySidebar />
              </Suspense>
            )}
          </div>

          {/* Mobile sidebar - overlay */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
              <div className="relative flex w-64 flex-col">
                {mounted && (
                  <Suspense fallback={null}>
                    <LazySidebar />
                  </Suspense>
                )}
                <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-sm font-semibold sm:text-base text-primary uppercase tracking-wider">Verdura</h1>
              </div>
              {mounted && (
                <Suspense fallback={null}>
                  <LazyRoleSwitcher />
                </Suspense>
              )}
            </header>
            <main className="flex-1 overflow-x-hidden">
              <React.Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <Outlet />
              </React.Suspense>
            </main>
          </div>
        </div>
        {mounted && (
          <Suspense fallback={null}>
            <LazyToaster />
          </Suspense>
        )}
      </AuthProvider>
    </QueryClientProvider>
  );
}

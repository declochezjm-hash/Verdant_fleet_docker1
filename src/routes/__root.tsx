import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Sidebar } from "@/components/views/sidebar";
import { RoleSwitcher } from "@/components/role-switcher";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { VerduraPageContextProvider } from "@/lib/verdura-page-context";
import { VerduraChatProvider } from "@/hooks/useVerduraChat";
import { VerduraChatHost } from "@/components/chat/VerduraFloatingButton";
import { Menu, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import appCss from "../styles.css?url";

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
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" }
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Render full HTML only on the server. On the client we must only return
  // the children so React doesn't attempt to render <html> inside the
  // existing document (which causes hydration errors like "<html> cannot be
  // a child of <div>").
  if (typeof window === "undefined") {
    return (
      <html lang="fr">
        <head>
          <HeadContent />
        </head>
        <body>
          <div id="root">{children}</div>
          <Scripts />
        </body>
      </html>
    );
  }

  // Client-side: return only the children (already inside the server's
  // <div id="root">), avoid rendering document-level tags.
  return <>{children}</>;
}

function AuthenticatedVerduraChat() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <VerduraChatHost />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Empêche le mismatch Desktop/Mobile lors du premier rendu SSR
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VerduraPageContextProvider>
          <VerduraChatProvider>
            <div className="flex min-h-screen w-full bg-background">
              {/* Desktop Sidebar */}
              <div className="hidden md:flex">
                <Sidebar />
              </div>

              {/* Mobile Sidebar Overlay */}
              {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                  <div className="relative flex w-64 flex-col">
                    {mounted && <Sidebar />}
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
                  <RoleSwitcher />
                </header>
                <main className="flex-1 overflow-x-hidden">
                  <React.Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                    <Outlet />
                  </React.Suspense>
                </main>
              </div>
            </div>
            <Toaster />
            <AuthenticatedVerduraChat />
          </VerduraChatProvider>
        </VerduraPageContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

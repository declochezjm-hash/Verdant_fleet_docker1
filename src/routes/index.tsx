import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, AuthState } from "@/lib/auth-context"; // Import AuthState
import { Button } from "@/components/ui/button";
import { AgentSupabaseView } from "@/components/views/agent-supabase-view";
import { CoordinatorDashboard } from "@/components/views/coordinator-dashboard";
import { AdminAnalytics } from "@/components/views/admin-analytics";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

// Helper component for consistent loading state
function LoadingScreen() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Index() {
  const { loading, session, primaryRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!loading && !session) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, navigate]);

  // Timeout de sécurité : si loading dure trop longtemps, on force la redirection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("[Index] Timeout de chargement Supabase atteint, redirection vers /auth");
        setLoadingTimeout(true);
        navigate({ to: "/auth" });
      }
    }, 10000); // 10 secondes de timeout
    return () => clearTimeout(timer);
  }, [loading, navigate]);

  // On attend le montage ET la résolution de la session
  if (!mounted || loading) {
    return <LoadingScreen />;
  }

  if (!session) return null; // La redirection useEffect s'en occupe

  if (!primaryRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="max-w-xl rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold">Compte connecté sans rôle</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Votre connexion a réussi, mais aucun rôle n'a été trouvé pour ce compte.
            Vérifiez que votre profil Supabase existe dans la table <code>profiles</code> et que la table <code>user_roles</code> contient une entrée pour <code>user_id</code>.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate({ to: "/auth" })}>
              Retour à la connexion
            </Button>
            <Button onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (primaryRole === "agent") return <AgentSupabaseView />;
  if (primaryRole === "admin") return <AdminAnalytics />;
  return <CoordinatorDashboard />;
}

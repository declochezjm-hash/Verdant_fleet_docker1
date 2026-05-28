import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AgentSupabaseView } from "@/components/views/agent-supabase-view";
import { CoordinatorDashboard } from "@/components/views/coordinator-dashboard";
import { AdminAnalytics } from "@/components/views/admin-analytics";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { loading, session, primaryRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  // On attend que le chargement soit fini, qu'une session existe ET que le rôle soit identifié
  if (loading || !session || !primaryRole) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (primaryRole === "agent") return <AgentSupabaseView />;
  if (primaryRole === "admin") return <AdminAnalytics />;
  return <CoordinatorDashboard />;
}

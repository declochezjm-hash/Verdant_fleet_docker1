import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // On évite tout traitement sur le serveur pour prévenir les erreurs 500
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthCallbackContent />;
}

function AuthCallbackContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Le client Supabase traite automatiquement le code présent dans l'URL.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erreur d'authentification:", error.message);
          toast.error("Échec de la connexion.");
          navigate({ to: "/auth" });
          return;
        }

        if (data.session) {
          toast.success("Connexion réussie !");
          navigate({ to: "/" });
        } else {
          navigate({ to: "/auth" });
        }
      } catch (err) {
        console.error("Erreur inattendue lors de la connexion:", err);
        navigate({ to: "/auth" });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Finalisation de la connexion</h2>
          <p className="text-sm text-muted-foreground animate-pulse">
            Nous préparons votre espace de travail Verdura...
          </p>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function ResetPasswordView() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      return toast.error("Le mot de passe doit contenir au moins 6 caractères.");
    }
    
    if (password !== confirmPassword) {
      return toast.error("Les mots de passe ne correspondent pas.");
    }

    setLoading(true);
    try {
      // Supabase utilise la session de récupération active pour mettre à jour l'utilisateur
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      toast.success("Votre mot de passe a été mis à jour !");
      
      // Redirection automatique après 3 secondes vers l'accueil/login
      setTimeout(() => {
        navigate({ to: "/" });
      }, 3000);
      
    } catch (error: any) {
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md border-2 shadow-lg text-center p-6 space-y-4 animate-in zoom-in-95 duration-300">
          <div className="mx-auto bg-success/10 w-16 h-16 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl">Mot de passe modifié</CardTitle>
            <CardDescription>
              Votre accès a été sécurisé avec succès. Vous allez être redirigé vers l'application...
            </CardDescription>
          </CardHeader>
          <Button className="w-full" onClick={() => navigate({ to: "/" })}>
            Accéder au tableau de bord
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md border-2 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">Sécuriser votre accès</CardTitle>
          </div>
          <CardDescription>
            Saisissez votre nouveau mot de passe pour finaliser la réinitialisation de votre compte Verdant Fleet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="Au moins 6 caractères"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Répétez le mot de passe"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Mettre à jour mon mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
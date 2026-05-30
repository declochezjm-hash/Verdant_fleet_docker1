import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, isConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Leaf, Loader2 } from "lucide-react";

async function authWithTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Aucune réponse de Supabase après ${timeoutMs / 1000}s. Vérifiez votre réseau et la configuration .env.`,
            ),
        ),
        timeoutMs,
      ),
    ),
  ]) as Promise<T>;
}

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  if (!isConfigured) {
    return <div className="p-8 text-center bg-destructive/10 text-destructive border border-destructive m-4 rounded-lg"> Configuration Supabase manquante. Vérifiez votre fichier .env </div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15"><Leaf className="h-6 w-6 text-primary" /></div>
          <CardTitle>Verdura</CardTitle>
          <CardDescription>Gestion espaces verts</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignInForm /></TabsContent>
            <TabsContent value="signup"><SignUpForm /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    console.log("Tentative de connexion pour:", email);
    try {
      if (!supabase) {
        toast.error("Le client Supabase n'est pas initialisé. Vérifiez vos variables d'environnement.");
        return;
      }
      const { error } = await authWithTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) {
        console.error("Détails erreur connexion:", error);
        toast.error(error.message);
      } else {
        toast.success("Connexion réussie");
      }
    } catch (err) {
      console.error("Erreur de connexion inattendue:", err);
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3 pt-3">
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mot de passe</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Se connecter
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("Équipe Nord");
  const [role, setRole] = useState<"agent" | "coordinator" | "admin">("agent");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    console.log("Tentative d'inscription pour:", email, "Rôle:", role);
    try {
      const redirectUrl = `${window.location.origin}/`;
      if (!supabase) {
        toast.error("Client Supabase introuvable.");
        return;
      }
      const { error } = await authWithTimeout(
        supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { name, team, role }
          },
        }),
      );
      if (error) {
        console.error("Détails erreur inscription:", error);
        toast.error(error.message);
      } else {
        toast.success("Compte créé ! Vérifiez vos emails si la confirmation est activée.");
      }
    } catch (err) {
      console.error("Erreur inattendue:", err);
      toast.error("Une erreur inattendue est survenue lors de l'inscription.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 pt-3">
      <div><Label>Nom complet</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>Mot de passe</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Équipe</Label>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Équipe Nord">Équipe Nord</SelectItem>
              <SelectItem value="Équipe Sud">Équipe Sud</SelectItem>
              <SelectItem value="Coordination">Coordination</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Rôle</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent terrain</SelectItem>
              <SelectItem value="coordinator">Coordinateur</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer mon compte
      </Button>
    </form>
  );
}

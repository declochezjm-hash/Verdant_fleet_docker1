import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, UserCog, Euro, Loader2, Database, Rocket, Users, Plus, Trash2, Palette } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SettingsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentRole = user?.user_metadata?.role;

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  // Récupération de la liste des équipes
  const { data: teams = [] } = useQuery({
    queryKey: ["settings-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string, color: string }) => {
      const { error } = await supabase.from("teams").insert([{ name, color }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-teams"] });
      toast.success("Équipe créée !");
      setNewTeamName("");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-teams"] });
      toast.success("Équipe supprimée.");
    },
    onError: () => toast.error("L'équipe est probablement utilisée.")
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ userId, rate }: { userId: string, rate: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: rate })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Taux horaire mis à jour avec succès.");
    }
  });

  const [dirtyRates, setDirtyRates] = useState<Record<string, number>>({});
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#6366f1");
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      // On utilise rpc pour appeler une fonction SQL de peuplement
      const { error } = await supabase.rpc('seed_demo_data');
      if (error) throw error;
      
      toast.success("Données de démonstration générées !");
      queryClient.invalidateQueries(); // Rafraîchir toutes les données
    } catch (err: any) {
      toast.error("Erreur lors de la génération : " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (currentRole !== "coordinator" && currentRole !== "admin") {
    return (
      <div className="flex h-[60vh] items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-destructive">Accès restreint</h1>
          <p className="text-muted-foreground">Seuls les coordinateurs peuvent modifier les paramètres financiers.</p>
        </div>
      </div>
    );
  }

  const handleRateChange = (agentId: string, value: string) => {
    const val = parseFloat(value);
    setDirtyRates((prev) => ({ ...prev, [agentId]: isNaN(val) ? 0 : val }));
  };

  const handleSave = async (agentId: string) => {
    const rate = dirtyRates[agentId];
    if (rate === undefined) return;

    updateRateMutation.mutate(
      { userId: agentId, rate },
      {
        onSuccess: () => {
          setDirtyRates((prev) => {
            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        },
      }
    );
  };

  // On affiche tout le monde ou on filtre par métadonnées de rôle si besoin
  const agents = profiles;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les paramètres globaux et les taux de facturation interne.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card className="border-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Gestion des Équipes</CardTitle>
            </div>
            <CardDescription>Configurez les équipes et leurs couleurs d'affichage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Nom</label>
                <Input placeholder="Nom..." value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Couleur</label>
                <Input type="color" className="w-16 p-1 h-10" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)} />
              </div>
              <Button onClick={() => { if(newTeamName) createTeamMutation.mutate({ name: newTeamName, color: newTeamColor }); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {teams.map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: t.color }} />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTeamMutation.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      <Card className="border-2 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <CardTitle>Gestion des Taux Horaires Agents</CardTitle>
          </div>
          <CardDescription>
            Ces taux sont utilisés pour le calcul de la comptabilité analytique (coût de main-d'œuvre par chantier).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Section de déploiement de démo */}
          <div className="mb-8 rounded-lg border-2 border-dashed p-4 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Database className="h-4 w-4 text-primary" />
                  Environnement de Test
                </div>
                <p className="text-xs text-muted-foreground">
                  Générez instantanément des produits, du matériel et des chantiers fictifs pour tester les graphiques.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={isSeeding}
                    className="bg-background hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                    Générer les données démo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Générer des données de démonstration ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action va injecter des chantiers, des produits et du matériel fictifs dans votre base de données. 
                      Bien que cela n'écrase pas vos données existantes, cela peut encombrer vos listes et vos statistiques analytiques.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSeedData}>Confirmer la génération</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground font-semibold">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Équipe</th>
                  <th className="px-4 py-3 w-[200px]">Taux horaire (€/h)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agents.map((agent) => {
                  const currentRate = dirtyRates[agent.id] ?? Number(agent.hourly_rate);
                  const isDirty = dirtyRates[agent.id] !== undefined && dirtyRates[agent.id] !== Number(agent.hourly_rate);

                  return (
                    <tr key={agent.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-slate-900">{agent.name}</td>
                      <td className="px-4 py-3 text-slate-600">{agent.team}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <Euro className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="number"
                            value={currentRate}
                            onChange={(e) => handleRateChange(agent.id, e.target.value)}
                            className="h-9 pl-8 font-bold border-2 focus-visible:ring-primary"
                            step="0.5"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          size="sm" 
                          variant={!isDirty ? "ghost" : "default"}
                          onClick={() => handleSave(agent.id)}
                          disabled={!isDirty || updateRateMutation.isPending}
                          className="font-bold"
                        >
                          {updateRateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Enregistrer
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, UserCog, Euro, Loader2, Database, Rocket } from "lucide-react";
import { toast } from "sonner";

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
              <Button 
                variant="outline" 
                onClick={handleSeedData} 
                disabled={isSeeding}
                className="bg-background hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Générer les données démo
              </Button>
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
  );
}
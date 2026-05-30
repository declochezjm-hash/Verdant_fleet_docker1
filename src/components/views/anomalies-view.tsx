import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, Clock, Wrench, History as HistoryIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AnomaliesView() {
  const queryClient = useQueryClient();

  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ["anomalies-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anomalies")
        .select(`
          *,
          equipment (id, name, status),
          tasks (id, title, client),
          profiles (id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ anomalyId, equipmentId }: { anomalyId: string, equipmentId: string | null }) => {
      // 1. Marquer l'anomalie comme résolue
      const { error: anomalyError } = await supabase
        .from("anomalies")
        .update({ resolved: true })
        .eq("id", anomalyId);
      if (anomalyError) throw anomalyError;

      // 2. Si un équipement est lié, on le repasse en 'OK'
      if (equipmentId) {
        const { error: equipError } = await supabase
          .from("equipment")
          .update({ status: "OK", last_maintenance: new Date().toISOString().split('T')[0] })
          .eq("id", equipmentId);
        if (equipError) throw equipError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies-details"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-equipment"] });
      toast.success("Anomalie résolue et matériel remis en service.");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const pendingAnomalies = anomalies.filter(a => !a.resolved);
  const resolvedAnomalies = anomalies.filter(a => a.resolved);

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-destructive flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" /> Journal des Anomalies
        </h1>
        <p className="text-sm text-muted-foreground">Suivi des pannes et problèmes signalés sur le terrain.</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="pending" className="gap-2">
            À traiter {pendingAnomalies.length > 0 && <Badge variant="destructive" className="h-5 min-w-5 justify-center rounded-full p-1 text-[10px]">{pendingAnomalies.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <HistoryIcon className="h-4 w-4 mr-1" /> Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingAnomalies.length === 0 ? (
            <Card className="border-dashed py-12 flex flex-col items-center text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-4 opacity-20" />
              <h3 className="font-semibold text-lg">Aucune panne signalée</h3>
              <p className="text-muted-foreground">Tout le matériel est actuellement opérationnel.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingAnomalies.map((anomaly) => (
                <Card key={anomaly.id} className="border-l-4 border-l-destructive shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground flex gap-1 items-center">
                        <Clock className="h-3 w-3" /> {format(parseISO(anomaly.created_at), "d MMM, HH:mm", { locale: fr })}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      {(anomaly.equipment as any)?.name || "Matériel inconnu"}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground italic">Signalé par : {(anomaly.profiles as any)?.name}</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md bg-muted/50 p-3 text-sm border border-dashed italic">"{anomaly.description}"</div>
                    <Button 
                      className="w-full gap-2 font-bold" 
                      variant="outline" 
                      onClick={() => resolveMutation.mutate({ anomalyId: anomaly.id, equipmentId: anomaly.equipment_id })}
                      disabled={resolveMutation.isPending}
                    >
                      {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                      Marquer comme résolu
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved">
          <div className="rounded-md border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Matériel / Chantier</th>
                    <th className="px-4 py-3">Applicateur</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y italic">
                  {resolvedAnomalies.map((anomaly) => (
                    <tr key={anomaly.id} className="hover:bg-muted/10 transition-colors opacity-70">
                      <td className="px-4 py-3 text-xs">{format(parseISO(anomaly.created_at), "dd/MM/yy", { locale: fr })}</td>
                      <td className="px-4 py-3 font-medium text-xs">{(anomaly.equipment as any)?.name} <br/><span className="text-[10px] text-muted-foreground">{(anomaly.tasks as any)?.title}</span></td>
                      <td className="px-4 py-3 text-xs">{(anomaly.profiles as any)?.name}</td>
                      <td className="px-4 py-3 text-xs truncate max-w-[200px]">{anomaly.description}</td>
                      <td className="px-4 py-3 text-right"><Badge variant="outline" className="bg-success/5 text-success">Résolu</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock, Users, Wrench, Package, AlertTriangle, Euro, Play, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { TASK_STATUS_LABELS, getStatusVariant } from "@/lib/task-helpers";

interface Props {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailsSheet({ taskId, onOpenChange }: Props) {
  const open = !!taskId;

  const qc = useQueryClient();
  const statusMut = useMutation({
    mutationFn: async (next: "en_cours" | "termine") => {
      if (!taskId) return;
      const patch: { status: "en_cours" | "termine"; started_at?: string; finished_at?: string } = { status: next };
      if (next === "en_cours") patch.started_at = new Date().toISOString();
      if (next === "termine") patch.finished_at = new Date().toISOString();
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next === "en_cours" ? "Chantier démarré" : "Chantier terminé");
      qc.invalidateQueries({ queryKey: ["task-details", taskId] });
      qc.invalidateQueries({ queryKey: ["carte-tasks"] });
      qc.invalidateQueries({ queryKey: ["planning-tasks"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Action impossible"),
  });

  const q = useQuery({
    enabled: open,
    queryKey: ["task-details", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const [task, assigns, taskEquip, taskProducts, anomalies, profiles, equipment, products] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
        supabase.from("task_assignments").select("user_id").eq("task_id", taskId),
        supabase.from("task_equipment").select("equipment_id").eq("task_id", taskId),
        supabase.from("task_products").select("id,product_id,quantity,created_at").eq("task_id", taskId),
        supabase.from("anomalies").select("id,description,resolved,created_at,equipment_id,reported_by").eq("task_id", taskId),
        supabase.from("profiles").select("id,name,team"),
        supabase.from("equipment").select("id,name,type"),
        supabase.from("products").select("id,name,unit,price_per_unit"),
      ]);
      if (task.error) throw task.error;
      return {
        task: task.data,
        assigns: assigns.data ?? [],
        taskEquip: taskEquip.data ?? [],
        taskProducts: taskProducts.data ?? [],
        anomalies: anomalies.data ?? [],
        profiles: profiles.data ?? [],
        equipment: equipment.data ?? [],
        products: products.data ?? [],
      };
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {q.isLoading || !q.data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !q.data.task ? (
          <div className="p-4 text-sm text-muted-foreground">Chantier introuvable.</div>
        ) : (
          (() => {
            const d = q.data!;
            const t = d.task!;
            const agents = d.assigns
              .map((a) => d.profiles.find((p) => p.id === a.user_id))
              .filter(Boolean) as { id: string; name: string; team: string }[];
            const kits = d.taskEquip
              .map((te) => d.equipment.find((e) => e.id === te.equipment_id))
              .filter(Boolean) as { id: string; name: string; type: string }[];
            const usedProducts = d.taskProducts.map((tp) => {
              const p = d.products.find((pr) => pr.id === tp.product_id);
              return { ...tp, name: p?.name ?? "—", unit: p?.unit ?? "", price: Number(p?.price_per_unit ?? 0) };
            });
            const totalProducts = usedProducts.reduce((s, p) => s + Number(p.quantity) * p.price, 0);

            return (
              <>
                <SheetHeader className="text-left">
                  <div className="flex items-start justify-between gap-2">
                    <SheetTitle className="text-lg">{t.title}</SheetTitle>
                    <Badge variant={getStatusVariant(t.status)}>{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>
                  </div>
                  <SheetDescription className="text-sm">{t.client}</SheetDescription>
                </SheetHeader>

                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <span>{t.address || "Adresse non renseignée"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(parseISO(t.scheduled_at), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
                        {" · "}{Number(t.duration)}h
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t.team || "Équipe non assignée"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={t.status !== "planifie" || statusMut.isPending}
                      onClick={() => statusMut.mutate("en_cours")}
                    >
                      <Play className="mr-1.5 h-4 w-4" /> Démarrer
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={t.status !== "en_cours" || statusMut.isPending}
                      onClick={() => statusMut.mutate("termine")}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Terminer
                    </Button>
                  </div>

                  <Separator />

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Responsables ({agents.length})</h3>
                    {agents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun agent assigné.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {agents.map((a) => (
                          <Badge key={a.id} variant="secondary" className="font-normal">
                            {a.name}{a.team ? ` · ${a.team}` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" /> Kits matériel ({kits.length})
                    </h3>
                    {kits.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun matériel rattaché.</p>
                    ) : (
                      <ul className="space-y-1">
                        {kits.map((k) => (
                          <li key={k.id} className="flex items-center justify-between rounded-md border bg-card px-2 py-1.5">
                            <span>{k.name}</span>
                            <Badge variant="outline" className="text-[10px]">{k.type}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <Package className="h-3.5 w-3.5" /> Produits utilisés ({usedProducts.length})
                    </h3>
                    {usedProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun produit consommé.</p>
                    ) : (
                      <div className="space-y-1">
                        {usedProducts.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-md border bg-card px-2 py-1.5">
                            <span>{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {Number(p.quantity)} {p.unit} · {(Number(p.quantity) * p.price).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-end gap-1 pt-1 text-xs font-medium">
                          <Euro className="h-3 w-3" /> Total : {totalProducts.toFixed(2)} €
                        </div>
                      </div>
                    )}
                  </section>

                  {d.anomalies.length > 0 && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> Anomalies ({d.anomalies.length})
                      </h3>
                      <ul className="space-y-1">
                        {d.anomalies.map((a) => (
                          <li key={a.id} className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{a.description || "Anomalie signalée"}</span>
                              <Badge variant={a.resolved ? "secondary" : "destructive"} className="text-[10px]">
                                {a.resolved ? "Résolue" : "Ouverte"}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {format(parseISO(a.created_at), "d MMM yyyy HH'h'mm", { locale: fr })}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border bg-secondary/30 p-2">
                      <div className="text-muted-foreground">Budget</div>
                      <div className="font-semibold">{Number(t.budget).toFixed(2)} €</div>
                    </div>
                    <div className="rounded-md border bg-secondary/30 p-2">
                      <div className="text-muted-foreground">Coût main d'œuvre</div>
                      <div className="font-semibold">{t.labor_cost != null ? `${Number(t.labor_cost).toFixed(2)} €` : "—"}</div>
                    </div>
                  </div>

                  {t.notes && (
                    <div className="rounded-md border bg-card p-2 text-xs">
                      <div className="mb-1 font-semibold">Notes</div>
                      <p className="whitespace-pre-wrap text-muted-foreground">{t.notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()
        )}
      </SheetContent>
    </Sheet>
  );
}

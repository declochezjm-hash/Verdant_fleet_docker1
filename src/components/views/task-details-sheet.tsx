import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock, Users, Wrench, Package, AlertTriangle, Euro, Play, CheckCircle2, Sun, CloudRain, ExternalLink, Pencil, History, Calendar, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_STATUS_LABELS, getStatusVariant } from "@/lib/task-helpers";
import { TaskCreateDialog } from "./task-create-dialog";
import { WeatherBadge } from "../../../weather-badge";

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
      <SheetContent className="w-full overflow-y-auto sm:max-w-[600px] pr-6">
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

            const historyEvents = [
              { date: t.created_at, label: "Intervention planifiée", icon: Calendar, color: "text-muted-foreground" },
              ...(t.started_at ? [{ date: t.started_at, label: "Chantier démarré", icon: Play, color: "text-primary" }] : []),
              ...d.taskProducts.map((tp) => ({
                date: tp.created_at,
                label: `Consommation : ${d.products.find(p => p.id === tp.product_id)?.name || "Produit"} (${tp.quantity})`,
                icon: Package,
                color: "text-orange-500"
              })),
              ...d.anomalies.map((a) => ({
                date: a.created_at,
                label: `Panne signalée : ${a.description}`,
                icon: AlertTriangle,
                color: "text-destructive"
              })),
              ...(t.finished_at ? [{ date: t.finished_at, label: "Chantier clôturé", icon: CheckCircle2, color: "text-success" }] : []),
            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return (
              <>
                <SheetHeader className="text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      {t.project_number && (
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">N° {t.project_number}</Badge>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <WeatherBadge 
                          lat={t.lat} 
                          lng={t.lng} 
                          date={parseISO(t.scheduled_at)}
                          requiresDryWeather={t.requires_dry_weather}
                        />
                        <span className="text-[10px] text-muted-foreground font-medium italic">Prévisions locales</span>
                      </div>
                      <SheetTitle className="text-lg">{t.title}</SheetTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={getStatusVariant(t.status)} className="w-fit">{TASK_STATUS_LABELS[t.status] ?? t.status}</Badge>
                      <div className="flex items-center gap-2 print:hidden">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] uppercase font-bold gap-1.5 px-2"
                          onClick={() => window.print()}
                        >
                          <Printer className="h-3 w-3" /> Imprimer
                        </Button>
                        <TaskCreateDialog 
                          taskId={t.id} 
                          trigger={
                            <Button variant="outline" size="sm" className="h-7 text-[10px] uppercase font-bold gap-1.5 px-2">
                              <Pencil className="h-3 w-3" /> Éditer
                            </Button>
                          } 
                        />
                      </div>
                    </div>
                  </div>
                  <SheetDescription className="text-sm">{t.client}</SheetDescription>
                </SheetHeader>

                {t.weather_alert_status === 'mismatch' && (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase">Alerte Conformité Météo</p>
                      <p className="text-[11px]">Ce chantier a été réalisé sous la pluie alors qu'un temps sec était impératif.</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span>{t.address || "Adresse non renseignée"}</span>
                          {t.lat && t.lng && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 px-2 text-[10px] font-bold gap-1 shrink-0 print:hidden" 
                                >
                                  <ExternalLink className="h-3 w-3" /> Itinéraire
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=driving`, '_blank')}>
                                  Google Maps
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`https://www.waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`, '_blank')}>
                                  Waze
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
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
                    {t.requires_dry_weather && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Sun className="h-4 w-4" />
                        <span className="font-medium">Condition : Temps sec requis</span>
                      </div>
                    )}
                    {t.actual_weather && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <CloudRain className="h-4 w-4" />
                        <span className="font-medium">Météo constatée : {t.actual_weather}</span>
                      </div>
                    )}
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

                  <section className="pt-2">
                    <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                      <History className="h-3.5 w-3.5" /> Historique de l'intervention
                    </h3>
                    <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-border">
                      {historyEvents.map((ev, i) => (
                        <div key={i} className="relative flex gap-3 pl-7">
                          <div className={`absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm ${ev.color}`}>
                            <ev.icon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium leading-tight text-foreground truncate" title={ev.label}>
                              {ev.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(ev.date), "d MMM à HH'h'mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

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

                  {t.signature_url && (
                    <section className="pt-2">
                      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Signature client</h3>
                      <div className="w-48 h-24 border rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
                        <img src={t.signature_url} alt="Signature client" className="max-w-full max-h-full object-contain" />
                      </div>
                    </section>
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

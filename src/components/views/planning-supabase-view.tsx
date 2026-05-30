import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Wrench, Users, Loader2, Flame, AlertTriangle, Settings } from "lucide-react";
import { toast } from "sonner";
import { TaskDetailsSheet } from "./task-details-sheet";
import { TaskCreateDialog } from "./task-create-dialog";

interface Task {
  id: string; title: string; client: string; team: string;
  scheduled_at: string; duration: number; status: "planifie" | "en_cours" | "termine";
  priority?: "normale" | "haute" | "urgente";
}
interface Assign { task_id: string; user_id: string }
interface TaskEquip { task_id: string; equipment_id: string }

export function PlanningSupabaseView() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tasksQ = useQuery({
    queryKey: ["planning-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks")
        .select("id,title,client,team,scheduled_at,duration,status,priority")
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name,team");
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignsQ = useQuery({
    queryKey: ["assigns-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_assignments").select("task_id,user_id");
      if (error) throw error;
      return (data ?? []) as Assign[];
    },
  });

  const equipQ = useQuery({
    queryKey: ["equip-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const taskEquipQ = useQuery({
    queryKey: ["task-equip-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_equipment").select("task_id,equipment_id");
      if (error) throw error;
      return (data ?? []) as TaskEquip[];
    },
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, team, scheduled_at }: { id: string; team: string; scheduled_at: string }) => {
      const { error } = await supabase.from("tasks").update({ team, scheduled_at }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // On récupère les équipes avec leurs couleurs
  const { data: teamsFull = [] } = useQuery({
    queryKey: ["teams-full-data"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*").order("name");
      return data || [];
    }
  });

  // On dérive les noms des équipes depuis les profils pour garantir la visibilité
  // tout en complétant avec les équipes définies dans les paramètres.
  const teams = useMemo(() => {
    const fromProfiles = (profilesQ.data ?? []).map(p => p.team).filter(Boolean) as string[];
    const fromSettings = teamsFull.map(t => t.name);
    // Fusion des deux listes et suppression des doublons
    return Array.from(new Set([...fromProfiles, ...fromSettings])).sort();
  }, [profilesQ.data, teamsFull]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const visibleTeams = teamFilter === "all" ? teams : [teamFilter];
  const tasks = tasksQ.data ?? [];
  const tasksFor = (team: string, day: Date) =>
    tasks.filter((t) => t.team === team && isSameDay(parseISO(t.scheduled_at), day));

  const onDrop = (team: string, day: Date) => {
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    setOverKey(null);
    if (!t) return;
    const old = parseISO(t.scheduled_at);
    const next = new Date(day); next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    moveMut.mutate({ id: dragId, team, scheduled_at: next.toISOString() });
    toast.success(`Déplacé vers ${team} — ${format(day, "EEE d MMM", { locale: fr })}`);
    setDragId(null);
  };

  if (tasksQ.isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
          <p className="text-sm text-muted-foreground">Glissez-déposez les chantiers entre équipes et jours.</p>
        </div>
        <div className="flex items-center gap-2">
          <TaskCreateDialog />
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[180px] text-center text-sm font-medium">
            {mounted ? `Sem. du ${format(weekStart, "d MMM", { locale: fr })}` : "Chargement..."}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes équipes</SelectItem>
              {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {teams.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-warning/20 p-4 rounded-full mb-4">
                <AlertTriangle className="h-10 w-10 text-warning" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Aucune équipe configurée</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                Pour utiliser le planning, vous devez d'abord créer des équipes opérationnelles ou assigner vos agents à des équipes.
              </p>
              <Button asChild size="lg" className="gap-2 shadow-md">
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  Configurer les équipes
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          visibleTeams.map((team) => (
          <Card key={team}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: teamsFull.find(tf => tf.name === team)?.color || "#94a3b8" }} />
                <CardTitle className="text-base">{team}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {days.map((day) => {
                  const dayTasks = tasksFor(team, day);
                  const key = `${team}-${day.toISOString()}`;
                  const hot = dragId !== null && overKey === key;
                  return (
                    <div
                      key={key}
                      onDragOver={(e) => { e.preventDefault(); if (overKey !== key) setOverKey(key); }}
                      onDragLeave={() => { if (overKey === key) setOverKey(null); }}
                      onDrop={() => onDrop(team, day)}
                      className={`rounded-md border bg-secondary/30 p-2 transition-colors ${hot ? "border-primary bg-primary/10" : ""}`}
                    >
                      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        {format(day, "EEE d", { locale: fr })}
                      </div>
                      <div className="space-y-2 min-h-[60px]">
                        {dayTasks.map((t) => (
                          <PlanningCard key={t.id} task={t}
                            agentsCount={(assignsQ.data ?? []).filter((a) => a.task_id === t.id).length}
                            kits={(taskEquipQ.data ?? []).filter((te) => te.task_id === t.id)
                              .map((te) => (equipQ.data ?? []).find((e) => e.id === te.equipment_id)?.name).filter(Boolean) as string[]}
                            onDragStart={() => setDragId(t.id)}
                            onDragEnd={() => { setDragId(null); setOverKey(null); }}
                            onClick={() => setOpenTaskId(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      {/* Légende des couleurs d'équipes */}
      {teams.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-lg border border-dashed bg-muted/5 p-4 mt-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-full text-center mb-1 lg:w-auto lg:mb-0 lg:mr-2">Identification Équipes :</div>
          {teams.map((teamName) => {
            const teamColor = teamsFull.find(tf => tf.name === teamName)?.color || "#94a3b8";
            return (
              <div key={teamName} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: teamColor }} />
                <span className="text-xs font-medium text-foreground">{teamName}</span>
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </div>
  );
}

function PlanningCard({ task, agentsCount, kits, onDragStart, onDragEnd, onClick }:
  { task: Task; agentsCount: number; kits: string[]; onDragStart: () => void; onDragEnd: () => void; onClick: () => void }) {
  // On peut injecter la couleur ici si on souhaite que la bordure soit celle de l'équipe
  // Ou garder la bordure pour le statut et utiliser la couleur pour d'autres indicateurs.
  const isUrgent = task.priority === "urgente";
  const statusColor = task.status === "termine" ? "border-l-success" : task.status === "en_cours" ? "border-l-accent" : "border-l-primary";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-grab rounded-md border border-l-4 ${statusColor} bg-card p-2 text-xs shadow-sm hover:shadow-md active:cursor-grabbing transition-all ${isUrgent ? "ring-2 ring-destructive ring-offset-1 animate-pulse border-destructive" : ""}`}
    >
      <div className="flex items-center gap-1 font-semibold leading-tight">
        {isUrgent && <Flame className="h-3 w-3 text-destructive fill-destructive" />}
        <span>{task.title}</span>
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{task.client}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{format(parseISO(task.scheduled_at), "HH'h'")}</span>
        <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{agentsCount}</span>
      </div>
      {kits.length > 0 && (
        <div className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
          <Wrench className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{kits.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

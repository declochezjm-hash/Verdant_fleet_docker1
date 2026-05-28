import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Wrench, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TaskDetailsSheet } from "./task-details-sheet";

const TEAMS = ["Équipe Nord", "Équipe Sud"];

interface Task {
  id: string; title: string; client: string; team: string;
  scheduled_at: string; duration: number; status: "planifie" | "en_cours" | "termine";
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

  const tasksQ = useQuery({
    queryKey: ["planning-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks")
        .select("id,title,client,team,scheduled_at,duration,status")
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name");
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

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const visibleTeams = teamFilter === "all" ? TEAMS : [teamFilter];
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
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[180px] text-center text-sm font-medium">
            Sem. du {format(weekStart, "d MMM", { locale: fr })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes équipes</SelectItem>
              {TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {visibleTeams.map((team) => (
          <Card key={team}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{team}</CardTitle>
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
        ))}
      </div>
      <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </div>
  );
}

function PlanningCard({ task, agentsCount, kits, onDragStart, onDragEnd, onClick }:
  { task: Task; agentsCount: number; kits: string[]; onDragStart: () => void; onDragEnd: () => void; onClick: () => void }) {
  const color = task.status === "termine" ? "border-l-success" : task.status === "en_cours" ? "border-l-accent" : "border-l-primary";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-grab rounded-md border border-l-4 ${color} bg-card p-2 text-xs shadow-sm hover:shadow-md active:cursor-grabbing`}
    >
      <div className="font-semibold leading-tight">{task.title}</div>
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

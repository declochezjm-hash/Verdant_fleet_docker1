import { useState, useEffect, useMemo } from "react";
import { useStore, type Task } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Users, Wrench } from "lucide-react";
import { toast } from "sonner";

const TEAMS = ["Équipe Nord", "Équipe Sud"];

export function PlanningView() {
  const { tasks, users, equipment, reassignTaskTeam } = useStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const visibleTeams = teamFilter === "all" ? TEAMS : [teamFilter];

  const tasksFor = (team: string, day: Date) =>
    tasks.filter((t) => t.team === team && isSameDay(parseISO(t.date), day));

  const onDrop = (team: string, day: Date) => {
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    if (!t) return;
    const old = parseISO(t.date);
    const next = new Date(day); next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    reassignTaskTeam(dragId, team, next.toISOString());
    toast.success(`Déplacé vers ${team} — ${format(day, "EEE d MMM", { locale: fr })}`);
    setDragId(null);
  };

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
            {mounted ? `Sem. du ${format(weekStart, "d MMM", { locale: fr })}` : "..."}
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
                  const isOver = dragId !== null;
                  return (
                    <div
                      key={day.toISOString()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(team, day)}
                      className={`rounded-md border bg-secondary/30 p-2 transition-colors ${isOver ? "border-primary/50 bg-primary/5" : ""}`}
                    >
                      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                        {format(day, "EEE d", { locale: fr })}
                      </div>
                      <div className="space-y-2 min-h-[60px]">
                        {dayTasks.map((t) => (
                          <PlanningCard key={t.id} task={t} users={users} equipment={equipment} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} />
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
    </div>
  );
}

function PlanningCard({ task, users, equipment, onDragStart, onDragEnd }: {
  task: Task; users: ReturnType<typeof useStore.getState>["users"]; equipment: ReturnType<typeof useStore.getState>["equipment"];
  onDragStart: () => void; onDragEnd: () => void;
}) {
  const agents = task.assignedAgents.map((id) => users.find((u) => u.id === id)?.name.split(" ")[0]).filter(Boolean);
  const kits = task.equipmentIds.map((id) => equipment.find((e) => e.id === id)?.name).filter(Boolean);
  const color = task.status === "terminé" ? "border-l-success" : task.status === "en cours" ? "border-l-accent" : "border-l-primary";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-md border border-l-4 ${color} bg-card p-2 text-xs shadow-sm hover:shadow-md active:cursor-grabbing`}
    >
      <div className="font-semibold leading-tight">{task.title}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{task.client}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{format(parseISO(task.date), "HH'h'")}</span>
        <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{agents.length}</span>
      </div>
      {kits.length > 0 && (
        <div className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
          <Wrench className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{kits.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

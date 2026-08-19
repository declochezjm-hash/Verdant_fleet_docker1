import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Wrench, Users, Loader2, Flame, AlertTriangle, Settings } from "lucide-react";
import { toast } from "sonner";
import { getTeamColor } from "@/lib/team-utils";

// Composants stubs pour le débogage
const TaskDetailsSheet = () => null;
const TaskCreateDialog = () => null;
const WeatherIndicator = () => null;

interface Task {
  id: string; title: string; client: string; team: string;
  scheduled_at: string; duration: number; status: "planifie" | "en_cours" | "termine" | "annule";
  priority?: "normale" | "haute" | "urgente";
  lat: number | null; lng: number | null; requires_dry_weather: boolean;
}
interface Assign { task_id: string; user_id: string }
interface TaskEquip { task_id: string; equipment_id: string }

// Déplacement de PlanningCard ici pour éviter les problèmes de hoisting
function PlanningCard({ task, agentsCount, kits, onDragStart, onDragEnd, onClick }:
  { task: Task; agentsCount: number; kits: string[]; onDragStart: () => void; onDragEnd: () => void; onClick: () => void }) {
  const isUrgent = task.priority === "urgente";
  
  const statusColor = 
    task.status === "termine" ? "border-l-success" : 
    task.status === "en_cours" ? "border-l-accent" : 
    task.status === "annule" ? "border-l-destructive opacity-50" : 
    "border-l-primary";

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
      <div className="mt-0.5 flex items-center justify-between gap-1">
        <div className="truncate text-[10px] text-muted-foreground">{task.client}</div>
      </div>
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

export function PlanningSupabaseView() {
  // Version minimale pour le débogage
  return (
    <div className="p-4">
      <h1>Planning - Mode Débogage</h1>
      <p>Tous les composants complexes sont désactivés.</p>
    </div>
  );
}
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
              {teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t} <span className="ml-1 text-[10px] text-muted-foreground">({teamCosts[t]?.toFixed(0)}€/h)</span>
                </SelectItem>
              ))}
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
                <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: getTeamColor(team, teamsFull) }} />
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
            const teamColor = getTeamColor(teamName, teamsFull);
            return (
              <div key={teamName} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: teamColor }} />
                <span className="text-xs font-medium text-foreground">{teamName}</span>
              </div>
            );
          })}
        </div>
      )}

      {null /* <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} /> */}
    </div>
  );
}

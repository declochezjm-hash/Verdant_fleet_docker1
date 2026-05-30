import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Plus,
  Loader2,
  Calendar,
  MapPin,
  Building2,
  Briefcase,
  Clock,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Ban,
  Download,
  Pencil,
  Wrench,
  X,
  History as HistoryIcon,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskDetailsSheet } from "./task-details-sheet";
import { TaskCreateDialog } from "./task-create-dialog";

/**
 * Labels pour les statuts
 */
export const TASK_STATUS_LABELS: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé"
};

/**
 * Variantes de style pour les badges de statut
 */
export const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "planifie": return "secondary";
    case "en_cours": return "default";
    case "termine": return "outline";
    case "annule": return "destructive";
    default: return "secondary";
  }
};

export const getPriorityVariant = (priority: string): "secondary" | "default" | "destructive" => {
  switch (priority) {
    case "haute": return "default";
    case "urgente": return "destructive";
    default: return "secondary";
  }
};

export function CoordinatorView() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<any | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");

  console.log("CoordinatorView rendered. Checking for buttons...");

  // Récupération de toutes les tâches pour le suivi
  const { data: allTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["all-tasks-coordinator"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_assignments(user_id, profiles(name)),
          task_equipment(equipment_id)
        `)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Récupération des équipes pour obtenir les couleurs
  const { data: teamsData = [] } = useQuery({
    queryKey: ["teams-colors"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("name, color");
      return data || [];
    }
  });

  // Récupération des agents disponibles
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, team")
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  // Dérivation dynamique des équipes existantes
  const teams = useMemo(() => {
    const uniqueTeams = Array.from(new Set(agents.map(a => a.team))).filter(Boolean) as string[];
    return uniqueTeams.sort();
  }, [agents]);

  // Récupération du matériel disponible
  const { data: equipmentList = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, name, type")
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  // Calcul des tâches filtrées pour le tableau
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const matchesTeam = filterTeam === "all" || t.team === filterTeam;
      const searchLower = searchQuery.toLowerCase().trim();
      if (!searchLower) return matchesTeam;

      const matchesSearch = 
        [t.client, t.title, t.address].some(field => 
          field?.toLowerCase().includes(searchLower)
        );
      
      return matchesTeam && matchesSearch;
    });
  }, [allTasks, filterTeam, searchQuery]);

  const activeTasks = useMemo(() => 
    filteredTasks.filter(t => t.status === "planifie" || t.status === "en_cours"),
    [filteredTasks]
  );

  const historyTasks = useMemo(() => 
    filteredTasks.filter(t => t.status === "termine" || t.status === "annule"),
    [filteredTasks]
  );

  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "annule", finished_at: null }) // Nettoyage si besoin
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] }); // Invalider le planning aussi
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] }); // Important pour les stats
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-tasks"] });
      toast.success("Intervention annulée avec succès.");
      setSelectedTaskForAction(null);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de l'annulation : ${error.message}`);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] }); // Invalider le planning aussi
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-tasks"] });
      toast.success("Intervention supprimée avec succès.");
      setSelectedTaskForAction(null);
      setIsConfirmDeleteOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression : ${error.message}`);
      setIsConfirmDeleteOpen(false);
    }
  });

  const exportToCSV = () => {
    if (filteredTasks.length === 0) return toast.error("Aucune donnée à exporter");

    const headers = ["Client", "Mission", "Equipe", "Agent", "Date", "Statut"];
    const rows = filteredTasks.map(t => [
      t.client, t.title, t.team,
      (t.task_assignments as any)?.[0]?.profiles?.name || "Non assigné",
      format(parseISO(t.scheduled_at), "dd/MM/yyyy HH:mm"),
      TASK_STATUS_LABELS[t.status] || t.status
    ]);

    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporting_interventions_${format(new Date(), "dd-MM-yyyy")}.csv`);
    link.click();
    toast.success("Export CSV réussi");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des chantiers</h1>
          <p className="text-sm text-muted-foreground">Planifiez, modifiez et suivez vos interventions.</p>
        </div>

        <div className="flex items-center gap-2">
          <TaskCreateDialog 
            trigger={<Button className="font-bold shadow-sm"><Plus className="mr-2 h-4 w-4" /> Nouvelle Intervention</Button>} 
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-primary/20 p-2 rounded-lg"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-2xl font-bold">{activeTasks.length}</div>
              <div className="text-xs text-muted-foreground uppercase font-semibold">Total Missions</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-accent/20 p-2 rounded-lg"><Clock className="h-5 w-5 text-accent-foreground" /></div>
            <div>
              <div className="text-2xl font-bold">{activeTasks.filter(t => t.status === 'en_cours').length}</div>
              <div className="text-xs text-muted-foreground uppercase font-semibold">En cours</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-muted p-2 rounded-lg"><Calendar className="h-5 w-5 text-muted-foreground" /></div>
            <div>
              <div className="text-2xl font-bold">{activeTasks.filter(t => t.status === 'planifie').length}</div>
              <div className="text-xs text-muted-foreground uppercase font-semibold">À venir</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Interventions récentes</CardTitle>
          <div className="flex items-center gap-2">
             <div className="relative hidden sm:block">
               <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input 
                 placeholder="Rechercher (client, titre)..." 
                 className="pl-8 h-8 w-64" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
             </div>
             <Select value={filterTeam} onValueChange={setFilterTeam}>
               <SelectTrigger className="h-8 w-[140px] text-xs">
                 <Filter className="mr-2 h-3 w-3" />
                 <SelectValue placeholder="Équipe" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Toutes les équipes</SelectItem>
                 {teams.map(t => (
                   <SelectItem key={t} value={t}>{t}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground font-semibold">
                  <th className="px-4 py-3">Client / Mission</th>
                  <th className="px-4 py-3">Équipe / Agent</th>
                  <th className="px-4 py-3">Date prévue</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingTasks ? (
                  <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                ) : filteredTasks.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Aucune intervention enregistrée.</td></tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{t.client}</div>
                        <div className="text-xs text-muted-foreground">{t.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Badge 
                            variant="outline" 
                            className="w-fit text-[10px] mb-1 border-none text-white shadow-sm"
                            style={{ 
                              backgroundColor: teamsData.find(tm => tm.name === t.team)?.color || '#94a3b8' 
                            }}
                          >
                            {t.team}
                          </Badge>
                          <span className="text-xs font-medium">
                            {(t.task_assignments as any)?.[0]?.profiles?.name || "Non assigné"}
                          </span>
                          {t.task_equipment?.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                              <Wrench className="h-3 w-3" />
                              <span>{t.task_equipment.length} équipement(s)</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {format(parseISO(t.scheduled_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={getStatusVariant(t.status)}>
                            {TASK_STATUS_LABELS[t.status] || t.status}
                          </Badge>
                          {t.priority && t.priority !== 'normale' && (
                            <Badge variant={getPriorityVariant(t.priority)} className="text-[10px] uppercase w-fit">
                              {t.priority}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <TaskCreateDialog 
                              taskId={t.id} 
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Pencil className="mr-2 h-4 w-4" /> Modifier les infos
                                </DropdownMenuItem>
                              } 
                            />

                            {t.status !== "termine" && t.status !== "annule" && (
                              <DropdownMenuItem
                                onClick={() => cancelTaskMutation.mutate(t.id)}
                                disabled={cancelTaskMutation.isPending}
                              >
                                {cancelTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                                Annuler l'intervention
                              </DropdownMenuItem>
                            )}
                            {(t.status === "planifie" || t.status === "annule") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTaskForAction(t);
                                  setIsConfirmDeleteOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. La suppression de l'intervention "{selectedTaskForAction?.title}"
                  entraînera la perte de toutes les données associées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTaskMutation.mutate(selectedTaskForAction?.id)}
                  disabled={deleteTaskMutation.isPending}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleteTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
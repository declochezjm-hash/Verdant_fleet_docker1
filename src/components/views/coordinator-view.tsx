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
  History,
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

export function CoordinatorView() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // État local pour le formulaire (Dirty state pattern)
  const [formData, setFormData] = useState({
    title: "",
    client: "",
    address: "",
    scheduled_at: "",
    duration: "2",
    agentId: "",
    budget: "", // Ajout du champ budget
    team: "",
    equipmentIds: [] as string[]
  });
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

  // Mutation pour créer la tâche et l'assigner
  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. Insertion de la tâche
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: data.title,
          client: data.client,
          address: data.address,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
          duration: parseFloat(data.duration),
          team: data.team,
          status: "planifie",
          budget: parseFloat(data.budget) || 0 // Ajout du budget
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // 2. Assignation de l'agent
      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert({
          task_id: task.id,
          user_id: data.agentId
        });

      if (assignError) throw assignError;

      // 3. Assignation du matériel
      if (data.equipmentIds.length > 0) {
        const { error: equipError } = await supabase
          .from("task_equipment")
          .insert(data.equipmentIds.map(id => ({ task_id: task.id, equipment_id: id })));

        if (equipError) throw equipError;
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-tasks"] });
      toast.success("Intervention créée et assignée avec succès !");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création : ${error.message}`);
    }
  });

  // Mutation pour mettre à jour une tâche
  const updateTaskMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      // 1. Mise à jour de la tâche
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          title: data.title,
          client: data.client,
          address: data.address,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
          duration: parseFloat(data.duration),
          team: data.team,
          budget: parseFloat(data.budget) || 0, // Ajout du budget
        })
        .eq("id", data.id);

      if (taskError) throw taskError;

      // 2. Mise à jour de l'assignation
      await supabase.from("task_assignments").delete().eq("task_id", data.id);
      const { error: assignError } = await supabase
        .from("task_assignments")
        .insert({ task_id: data.id, user_id: data.agentId });
      if (assignError) throw assignError;

      // 3. Mise à jour du matériel
      await supabase.from("task_equipment").delete().eq("task_id", data.id);
      if (data.equipmentIds.length > 0) {
        const { error: equipError } = await supabase
          .from("task_equipment")
          .insert(data.equipmentIds.map(id => ({ task_id: data.id, equipment_id: id })));
        if (equipError) throw equipError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-tasks"] });
      toast.success("Intervention mise à jour !");
      setIsDialogOpen(false);
      setEditingTaskId(null);
      resetForm();
    },
    onError: (error: Error) => toast.error(`Erreur lors de la modification : ${error.message}`)
  });

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

  const resetForm = () => {
    setFormData({
      title: "", client: "", address: "", scheduled_at: "",
      duration: "2", agentId: "", team: "", budget: "",
      equipmentIds: []
    });
    setEditingTaskId(null);
  };

  const handleEditClick = (task: any) => {
    const agentId = task.task_assignments?.[0]?.user_id || "";
    const formattedDate = task.scheduled_at ? task.scheduled_at.substring(0, 16) : "";
    const equipmentIds = (task.task_equipment || []).map((te: any) => te.equipment_id);
    
    setFormData({
      title: task.title,
      client: task.client,
      address: task.address,
      scheduled_at: formattedDate,
      duration: String(task.duration),
      agentId: agentId,
      budget: String(task.budget), // Chargement du budget pour l'édition
      team: task.team,
      equipmentIds: equipmentIds
    });
    setEditingTaskId(task.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.team) return toast.error("Veuillez choisir une équipe");
    if (!formData.agentId) return toast.error("Veuillez assigner un agent");
    if (isNaN(parseFloat(formData.budget))) return toast.error("Le budget doit être un nombre valide.");
    if (editingTaskId) {
      updateTaskMutation.mutate({ ...formData, id: editingTaskId });
    } else {
      createTaskMutation.mutate(formData);
    }
  };

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

  const isPending = createTaskMutation.isPending || updateTaskMutation.isPending;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des chantiers</h1>
          <p className="text-sm text-muted-foreground">Planification, suivi temps réel et journal d'activité.</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="font-bold shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Nouvelle Intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingTaskId ? "Modifier l'intervention" : "Créer une intervention"}</DialogTitle>
              <DialogDescription>
                {editingTaskId ? "Modifiez les détails du chantier existant." : "Planifiez un nouveau chantier et assignez un agent responsable."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre de l'intervention</Label>
                <Input id="title" required value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ex: Tonte Parc Municipal" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="team">Équipe</Label>
                  <Select value={formData.team} onValueChange={(val) => setFormData(prev => ({ ...prev, team: val }))}>
                    <SelectTrigger><SelectValue placeholder="Équipe..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Équipe Nord">Équipe Nord</SelectItem>
                      <SelectItem value="Équipe Sud">Équipe Sud</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent">Agent responsable</Label>
                  <Select value={formData.agentId} onValueChange={(val) => setFormData(prev => ({ ...prev, agentId: val }))}>
                    <SelectTrigger>{loadingAgents ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Agent..." />}</SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Input id="client" required value={formData.client} onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))} placeholder="Nom du client" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Date & Heure</Label>
                  <Input id="scheduled_at" type="datetime-local" required value={formData.scheduled_at} onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget prévisionnel (€)</Label>
                <Input id="budget" type="number" step="0.01" required value={formData.budget} onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))} placeholder="Ex: 1200.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" required value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} placeholder="Lieu de l'intervention" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Matériel rattaché
                </Label>
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {formData.equipmentIds.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun matériel sélectionné.</p>}
                  {formData.equipmentIds.map(id => {
                    const eq = equipmentList.find(e => e.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="pl-2 pr-1 gap-1">
                        {eq?.name || "Matériel inconnu"}
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, equipmentIds: prev.equipmentIds.filter(x => x !== id) }))} className="rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
                <Select onValueChange={(val) => {
                  if (!formData.equipmentIds.includes(val)) {
                    setFormData(prev => ({ ...prev, equipmentIds: Array.from(new Set([...prev.equipmentIds, val])) }));
                  }
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Ajouter du matériel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentList.filter(e => !formData.equipmentIds.includes(e.id)).map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTaskId ? "Enregistrer les modifications" : "Confirmer la planification"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                 <SelectItem value="Équipe Nord">Équipe Nord</SelectItem>
                 <SelectItem value="Équipe Sud">Équipe Sud</SelectItem>
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
                          <Badge variant="outline" className="w-fit text-[10px] mb-1">{t.team}</Badge>
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
                        <Badge variant={getStatusVariant(t.status)}>
                          {TASK_STATUS_LABELS[t.status] || t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Ouvrir le menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(t)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier les infos
                            </DropdownMenuItem>

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
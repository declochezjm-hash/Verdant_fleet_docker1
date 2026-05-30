import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogFooterPrimitive, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface TaskCreateDialogProps {
  trigger?: React.ReactNode;
  defaultTeam?: string;
  taskId?: string | null;
}

export function TaskCreateDialog({ 
  trigger, 
  defaultTeam = "Équipe Nord",
  taskId
}: TaskCreateDialogProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    client: "",
    address: "",
    scheduled_at: "",
    agentId: "",
    team: defaultTeam,
    duration: "2",
    budget: "0",
    equipmentIds: [] as string[],
    notes: "",
    priority: "normale"
  });

  const resetForm = () => {
    setFormData({
      title: "",
      client: "",
      address: "",
      scheduled_at: "",
      agentId: "",
      team: defaultTeam,
      duration: "2",
      budget: "0",
      equipmentIds: [] as string[],
      notes: "",
      priority: "normale"
    });
  };

  // Récupération des données de la tâche en cas de modification
  const { data: editingTask, isLoading: isLoadingTask } = useQuery({
    queryKey: ["task-edit-details", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_assignments(user_id),
          task_equipment(equipment_id)
        `)
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && isDialogOpen,
  });

  // Mise à jour du formulaire quand les données de la tâche sont chargées
  useEffect(() => {
    if (editingTask && isDialogOpen) {
      setFormData({
        title: editingTask.title,
        client: editingTask.client,
        address: editingTask.address,
        scheduled_at: editingTask.scheduled_at ? editingTask.scheduled_at.substring(0, 16) : "",
        agentId: editingTask.task_assignments?.[0]?.user_id || "",
        team: editingTask.team,
        duration: String(editingTask.duration),
        budget: String(editingTask.budget),
        equipmentIds: editingTask.task_equipment?.map((te: any) => te.equipment_id) || [],
        notes: editingTask.notes || "",
        priority: editingTask.priority || "normale"
      });
    } else if (!taskId && isDialogOpen) {
      resetForm();
    }
  }, [editingTask, isDialogOpen, taskId, defaultTeam]);

  // Récupération des listes pour les selects
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-list-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: allEquipment = [] } = useQuery({
    queryKey: ["equipment-list-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id, name").order("name");
      if (error) throw error;
      return data;
    }
  });

  const saveTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let targetId = taskId;

      if (taskId) {
        // 1. UPDATE Task
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            title: data.title,
            client: data.client,
            address: data.address,
            scheduled_at: new Date(data.scheduled_at).toISOString(),
            duration: parseFloat(data.duration),
            team: data.team,
            budget: parseFloat(data.budget) || 0,
            notes: data.notes,
            priority: data.priority,
          })
          .eq("id", taskId);
        if (taskError) throw taskError;

        // 2. Sync Assignments (delete then insert)
        await supabase.from("task_assignments").delete().eq("task_id", taskId);
        if (data.agentId) {
          await supabase.from("task_assignments").insert({ task_id: taskId, user_id: data.agentId });
        }

        // 3. Sync Equipment
        await supabase.from("task_equipment").delete().eq("task_id", taskId);
        if (data.equipmentIds.length > 0) {
          await supabase.from("task_equipment").insert(
            data.equipmentIds.map(id => ({ task_id: taskId!, equipment_id: id }))
          );
        }
      } else {
        // 1. INSERT Task
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
            budget: parseFloat(data.budget) || 0,
            notes: data.notes,
            priority: data.priority
          })
          .select().single();
        if (taskError) throw taskError;
        targetId = task.id;

        if (data.agentId) {
          await supabase.from("task_assignments").insert({ task_id: targetId, user_id: data.agentId });
        }

        if (data.equipmentIds.length > 0) {
          await supabase.from("task_equipment").insert(
            data.equipmentIds.map(id => ({ task_id: targetId!, equipment_id: id }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      toast.success(taskId ? "Intervention mise à jour !" : "Intervention créée !");
      setIsDialogOpen(false);
      if (!taskId) resetForm();
    },
    onError: (error: Error) => toast.error(`Erreur : ${error.message}`)
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["task-edit-details", taskId] }); // Invalider la tâche éditée
      queryClient.invalidateQueries({ queryKey: ["task-details"] }); // Pour la TaskDetailsSheet
      toast.success("Intervention supprimée !");
      setIsDialogOpen(false);
      setIsConfirmDeleteOpen(false);
    },
    onError: (error: Error) => toast.error(`Erreur lors de la suppression : ${error.message}`)
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.scheduled_at || !formData.agentId) {
      return toast.error("Champs obligatoires manquants");
    }
    saveTaskMutation.mutate(formData);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau chantier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{taskId ? "Modifier l'intervention" : "Nouvelle intervention"}</DialogTitle>
          <DialogDescription>{taskId ? "Mettez à jour les détails du chantier." : "Planification rapide."}</DialogDescription>
        </DialogHeader>
        {isLoadingTask ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="space-y-2">
            <Label htmlFor="title">Mission</Label>
            <Input id="title" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input id="client" required value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="datetime-local" required value={formData.scheduled_at} onChange={e => setFormData({ ...formData, scheduled_at: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">Durée prévue (h)</Label>
              <Input id="duration" type="number" step="0.5" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (€)</Label>
              <Input id="budget" type="number" step="1" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Équipe</Label>
              <Select value={formData.team} onValueChange={val => setFormData({ ...formData, team: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Équipe Nord">Équipe Nord</SelectItem>
                  <SelectItem value="Équipe Sud">Équipe Sud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select value={formData.priority} onValueChange={val => setFormData({ ...formData, priority: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={formData.agentId} onValueChange={val => setFormData({ ...formData, agentId: val })}>
                <SelectTrigger><SelectValue placeholder="Choisir agent..." /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Consignes</Label>
            <Textarea 
              id="notes" 
              placeholder="Instructions pour l'agent (ex: code portail, précautions particulières...)" 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label>Matériel</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.equipmentIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {allEquipment.find(e => e.id === id)?.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setFormData({ ...formData, equipmentIds: formData.equipmentIds.filter(x => x !== id) })} />
                </Badge>
              ))}
            </div>
            <Select onValueChange={val => !formData.equipmentIds.includes(val) && setFormData({ ...formData, equipmentIds: [...formData.equipmentIds, val] })}>
              <SelectTrigger><SelectValue placeholder="Ajouter matériel..." /></SelectTrigger>
              <SelectContent>
                {allEquipment.filter(e => !formData.equipmentIds.includes(e.id)).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            {taskId && (
              <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="gap-2" disabled={deleteTaskMutation.isPending}>
                    {deleteTaskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. La suppression de l'intervention "{editingTask?.title || "cette tâche"}"
                      entraînera la perte de toutes les données associées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooterPrimitive>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => taskId && deleteTaskMutation.mutate(taskId)}
                      disabled={deleteTaskMutation.isPending}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {deleteTaskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooterPrimitive>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={saveTaskMutation.isPending}>
              {saveTaskMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
              {taskId ? "Mettre à jour" : "Planifier"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X, Trash2, RefreshCw, MapPin, Locate, Search, Calendar, Briefcase, Users, Wrench } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogFooterPrimitive, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN_KEY = "mapbox_public_token";

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

  // États pour le sélecteur de carte
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [token, setToken] = useState("");
  const mapPickerContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [formData, setFormData] = useState({
    project_number: "",
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
    priority: "normale",
    requires_dry_weather: false,
    lat: "",
    lng: ""
  });

  const resetForm = () => {
    setFormData({
      project_number: "",
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
      priority: "normale",
      requires_dry_weather: false,
      lat: "",
      lng: ""
    });
  };

  // Récupération du token Mapbox
  useEffect(() => {
    if (isDialogOpen) {
      const local = localStorage.getItem(TOKEN_KEY);
      const env = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
      setToken((local || env || "").trim().replace(/["']/g, ""));
    }
  }, [isDialogOpen]);

  // Initialisation et gestion de la carte de sélection
  useEffect(() => {
    if (!showMapPicker || !mapPickerContainer.current || !token || mapRef.current) return;

    mapboxgl.accessToken = token;
    
    const initialLng = parseFloat(formData.lng) || 4.85;
    const initialLat = parseFloat(formData.lat) || 45.75;

    try {
      const map = new mapboxgl.Map({
        container: mapPickerContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [initialLng, initialLat],
        zoom: formData.lng && formData.lat ? 15 : 10,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      if (formData.lng && formData.lat) {
        markerRef.current = new mapboxgl.Marker({ color: "hsl(var(--primary))" })
          .setLngLat([initialLng, initialLat])
          .addTo(map);
      }

      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        setFormData(prev => ({ ...prev, lat: String(lat.toFixed(6)), lng: String(lng.toFixed(6)) }));
        
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        } else {
          markerRef.current = new mapboxgl.Marker({ color: "hsl(var(--primary))" })
            .setLngLat([lng, lat])
            .addTo(map);
        }

        // Géocodage inverse : récupérer l'adresse à partir du clic
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const address = data.features[0].place_name;
            setFormData(prev => ({ ...prev, address }));
            setAddressSearch(address);
          }
        } catch (err) {
          console.error("Erreur géocodage inverse:", err);
        }
      });

      map.on('load', () => {
        setTimeout(() => map.resize(), 100);
      });
      
      mapRef.current = map;
    } catch (e) {
      console.error("MapPicker init error", e);
    }
  }, [showMapPicker, token]);

  // Cleanup de la carte quand le picker est masqué ou le dialogue fermé
  useEffect(() => {
    if ((!showMapPicker || !isDialogOpen) && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
    if (!isDialogOpen) setShowMapPicker(false);
  }, [showMapPicker, isDialogOpen]);

  const handleGeocode = async () => {
    if (!addressSearch.trim() || !token) return;
    
    setIsGeocoding(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressSearch)}.json?access_token=${token}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const placeName = data.features[0].place_name;
        
        setFormData(prev => ({ 
          ...prev, 
          lat: lat.toFixed(6), 
          lng: lng.toFixed(6),
          address: placeName 
        }));
        
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
          if (markerRef.current) {
            markerRef.current.setLngLat([lng, lat]);
          } else {
            markerRef.current = new mapboxgl.Marker({ color: "hsl(var(--primary))" })
              .setLngLat([lng, lat])
              .addTo(mapRef.current);
          }
        }
        toast.success("Position localisée !");
      } else {
        toast.error("Adresse introuvable.");
      }
    } catch (err) {
      toast.error("Erreur lors de la recherche d'adresse.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const latStr = String(latitude.toFixed(6));
        const lngStr = String(longitude.toFixed(6));
        
        setFormData(prev => ({ ...prev, lat: latStr, lng: lngStr }));
        
        if (mapRef.current) {
          if (markerRef.current) {
            markerRef.current.setLngLat([longitude, latitude]);
          } else {
            markerRef.current = new mapboxgl.Marker({ color: "hsl(var(--primary))" })
              .setLngLat([longitude, latitude])
              .addTo(mapRef.current);
          }
          
          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1000
          });
        }
        setIsLocating(false);
      },
      () => {
        toast.error("Impossible d'accéder à votre position.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const generateProjectNumber = async () => {
    const year = new Date().getFullYear();
    const prefix = `C${year}-`;
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("project_number")
        .ilike("project_number", `${prefix}%`)
        .order("project_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      const latestTask = data && data.length > 0 ? data[0] : null;

      if (latestTask?.project_number) {
        // Extrait le nombre à la fin du projet (ex: extrait 10 de C2024-10)
        const match = latestTask.project_number.match(/-(\d+)$/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const formattedNumber = `${prefix}${String(nextNumber).padStart(2, '0')}`;
      setFormData(prev => ({ ...prev, project_number: formattedNumber }));
      toast.success(`N° Chantier généré : ${formattedNumber}`);
    } catch (err) {
      console.error("Erreur génération numéro:", err);
      toast.error("Impossible de générer le numéro automatiquement.");
    }
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
        project_number: editingTask.project_number || "",
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
        priority: editingTask.priority || "normale",
        requires_dry_weather: editingTask.requires_dry_weather || false,
        lat: editingTask.lat ? String(editingTask.lat) : "",
        lng: editingTask.lng ? String(editingTask.lng) : ""
      });
      setAddressSearch(editingTask.address);
    } else if (!taskId && isDialogOpen) {
      resetForm();
      setAddressSearch("");
    }
  }, [editingTask, isDialogOpen, taskId, defaultTeam]);

  // Récupération des listes pour les selects
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-list-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name, team, hourly_rate").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-list-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("name, overhead_labor_pct, overhead_equip_pct, margin_pct, tax_pct").eq("is_archived", false).order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: allEquipment = [] } = useQuery({
    queryKey: ["equipment-list-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id, name, hourly_cost, team, assigned_to").order("name");
      if (error) throw error;
      return data;
    }
  });

  const consolidatedTeams = useMemo(() => {
    const fromProfiles = agents.map(a => a.team).filter(Boolean) as string[];
    const fromDB = teams.map(t => t.name);
    
    // On force l'inclusion des équipes standards Nord et Sud
    const set = new Set([...fromProfiles, ...fromDB, "Équipe Nord", "Équipe Sud"]);
    if (formData.team) set.add(formData.team);
    
    return Array.from(set).filter(Boolean).sort();
  }, [agents, teams, formData.team]);

  // Calcul des coûts pour le sélecteur
  const teamCosts = useMemo(() => {
    const map: Record<string, number> = {};
    consolidatedTeams.forEach(teamName => {
      const teamConfig = teams.find(t => t.name === teamName);
      const teamAgents = agents.filter(p => p.team === teamName);
      const labor = teamAgents.reduce((s, a) => s + (Number(a.hourly_rate) || 0), 0);
      const equip = allEquipment
        .filter(e => e.team === teamName || teamAgents.some(a => a.id === e.assigned_to))
        .reduce((s, e) => s + (Number(e.hourly_cost) || 0), 0);
      
      const laborCharged = labor * (1 + (teamConfig?.overhead_labor_pct || 0) / 100);
      const equipCharged = equip * (1 + (teamConfig?.overhead_equip_pct || 0) / 100);
      const subtotal = laborCharged + equipCharged;
      const withMargin = subtotal * (1 + (teamConfig?.margin_pct || 0) / 100);
      const final = withMargin * (1 + (teamConfig?.tax_pct || 0) / 100);
      
      map[teamName] = final;
    });
    return map;
  }, [consolidatedTeams, agents, allEquipment]);

  const totalEstimatedCost = useMemo(() => {
    const hourlyCost = teamCosts[formData.team] || 0;
    const duration = parseFloat(formData.duration) || 0;
    return hourlyCost * duration;
  }, [formData.team, formData.duration, teamCosts]);

  const saveTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let targetId = taskId;

      if (taskId) {
        // 1. UPDATE Task
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            project_number: data.project_number,
            title: data.title,
            client: data.client,
            address: data.address,
            scheduled_at: new Date(data.scheduled_at).toISOString(),
            duration: parseFloat(data.duration),
            team: data.team,
            budget: parseFloat(data.budget) || 0,
            notes: data.notes,
            priority: data.priority,
            requires_dry_weather: data.requires_dry_weather,
            lat: data.lat ? parseFloat(data.lat) : null,
            lng: data.lng ? parseFloat(data.lng) : null,
          })
          .eq("id", taskId);
        if (taskError) throw taskError;

        // 2. Sync Assignments (delete then insert)
        const { error: delAssignError } = await supabase.from("task_assignments").delete().eq("task_id", taskId);
        if (delAssignError) throw delAssignError;

        if (data.agentId) {
          const { error: insAssignError } = await supabase.from("task_assignments").insert({ task_id: taskId, user_id: data.agentId });
          if (insAssignError) throw insAssignError;
        }

        // 3. Sync Equipment
        const { error: delEquipError } = await supabase.from("task_equipment").delete().eq("task_id", taskId);
        if (delEquipError) throw delEquipError;

        if (data.equipmentIds.length > 0) {
          const { error: insEquipError } = await supabase.from("task_equipment").insert(
            data.equipmentIds.map(id => ({ task_id: taskId!, equipment_id: id }))
          );
          if (insEquipError) throw insEquipError;
        }
      } else {
        // 1. INSERT Task
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            project_number: data.project_number,
            title: data.title,
            client: data.client,
            address: data.address,
            scheduled_at: new Date(data.scheduled_at).toISOString(),
            duration: parseFloat(data.duration),
            team: data.team,
            status: "planifie",
            budget: parseFloat(data.budget) || 0,
            notes: data.notes,
            priority: data.priority,
            requires_dry_weather: data.requires_dry_weather,
            lat: data.lat ? parseFloat(data.lat) : null,
            lng: data.lng ? parseFloat(data.lng) : null,
          })
          .select().single();
        if (taskError) throw taskError;
        targetId = task.id;

        if (data.agentId) {
          const { error: insAssignError } = await supabase.from("task_assignments").insert({ task_id: targetId, user_id: data.agentId });
          if (insAssignError) throw insAssignError;
        }

        if (data.equipmentIds.length > 0) {
          const { error: insEquipError } = await supabase.from("task_equipment").insert(
            data.equipmentIds.map(id => ({ task_id: targetId!, equipment_id: id }))
          );
          if (insEquipError) throw insEquipError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["planning-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks-coordinator"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-tasks"] });
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
    if (!formData.project_number || !formData.title || !formData.scheduled_at || !formData.agentId) {
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{taskId ? "Modifier l'intervention" : "Nouvelle intervention"}</DialogTitle>
            {taskId && (
              <Badge variant="outline" className="text-[10px] uppercase font-bold">Mode Édition</Badge>
            )}
          </div>
          <DialogDescription>{taskId ? "Mettez à jour les détails du chantier." : "Planification rapide."}</DialogDescription>
        </DialogHeader>
        {isLoadingTask ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-8 py-4">
          {/* Section: Informations générales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Informations Chantier</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_number">N° Chantier</Label>
                <div className="flex gap-1">
                  <Input id="project_number" required placeholder="Ex: C2024-01" value={formData.project_number} onChange={e => setFormData({ ...formData, project_number: e.target.value })} />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={generateProjectNumber} title="Générer automatiquement">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Libellé de la Mission</Label>
                <Input id="title" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input id="client" required value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget estimé (€)</Label>
                <Input id="budget" type="number" step="1" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Section: Planification */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Planification</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date & Heure prévue</Label>
                <Input id="date" type="datetime-local" required value={formData.scheduled_at} onChange={e => setFormData({ ...formData, scheduled_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Durée estimée (h)</Label>
                <Input id="duration" type="number" step="0.5" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Équipe</Label>
                <Select value={formData.team} onValueChange={val => setFormData({ ...formData, team: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {consolidatedTeams.map(t => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center justify-between w-full gap-4">
                          {t} <Badge variant="outline" className="text-[9px] font-mono">{teamCosts[t]?.toFixed(0)}€/h</Badge>
                        </span>
                      </SelectItem>
                    ))}
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

            {/* Affichage du Déboursé Sec Estimé */}
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/10 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimation financière</p>
                <p className="text-xs text-muted-foreground">
                  Coût équipe : <span className="font-mono">{(teamCosts[formData.team] || 0).toFixed(0)}€/h</span> × {formData.duration}h
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-primary mb-0.5">Déboursé Sec Total</p>
                <p className="text-xl font-black text-primary leading-none">{totalEstimatedCost.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          {/* Section: Localisation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Localisation</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground italic">Précision GPS (Optionnel)</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold gap-1 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setShowMapPicker(!showMapPicker)}>
                  <MapPin className="h-3 w-3" />
                  {showMapPicker ? "Masquer la carte" : "Pointer sur la carte"}
                </Button>
              </div>
              
              {showMapPicker && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Rechercher une adresse précise..." className="h-8 pl-8 text-[10px]" value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGeocode())} />
                    </div>
                    <Button type="button" size="sm" className="h-8 px-2 text-[10px] font-bold" onClick={handleGeocode} disabled={isGeocoding || !addressSearch.trim()}>
                      {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rechercher"}
                    </Button>
                  </div>
                  <div className="relative">
                    <div ref={mapPickerContainer} className="h-48 w-full rounded-md border bg-muted overflow-hidden relative shadow-inner" />
                    <Button type="button" variant="secondary" size="icon" className="absolute bottom-2 right-2 h-8 w-8 shadow-md border bg-background/80 backdrop-blur-sm hover:bg-background z-10" onClick={handleLocateMe} disabled={isLocating} title="Ma position">
                      {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="lat" className="text-[10px] uppercase text-muted-foreground">Latitude</Label>
                  <Input id="lat" type="number" step="any" placeholder="ex: 45.75" value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lng" className="text-[10px] uppercase text-muted-foreground">Longitude</Label>
                  <Input id="lng" type="number" step="any" placeholder="ex: 4.85" value={formData.lng} onChange={e => setFormData({ ...formData, lng: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Affectation & Ressources */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ressources & Notes</h3>
            </div>
            <div className="space-y-2">
              <Label>Responsable de l'intervention</Label>
              <Select value={formData.agentId} onValueChange={val => setFormData({ ...formData, agentId: val })}>
                <SelectTrigger><SelectValue placeholder="Choisir agent..." /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Consignes particulières</Label>
              <Textarea id="notes" placeholder="Instructions pour l'agent (ex: code portail...)" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/5">
              <div className="space-y-0.5">
                <Label htmlFor="dry-weather">Condition météorologique</Label>
                <p className="text-[10px] text-muted-foreground">Nécessite un temps sec pour intervention.</p>
              </div>
              <Switch id="dry-weather" checked={formData.requires_dry_weather} onCheckedChange={checked => setFormData({ ...formData, requires_dry_weather: checked })} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-6 border-t">
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
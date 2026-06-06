import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, subDays, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Wrench, History as HistoryIcon, User as UserIcon, Search, Filter, AlertTriangle, BarChart3, Fingerprint, Fuel, CarFront, FileText, Camera, Users } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Equipment {
  id: string;
  internal_id: string | null;
  name: string;
  type: string;
  assigned_to: string | null;
  hours_used: number;
  hours_for_maintenance: number;
  status: "OK" | "Maintenance requise" | "En panne";
  last_maintenance: string | null;
  hourly_cost: number;
  serial_number: string | null;
  registration_number: string | null;
  motorization_type: string | null;
  team: string | null;
  is_archived: boolean | null;
}

interface MaintenanceLog {
  id: string;
  equipmentId: string;
  date: string;
  type: "Révision" | "Réparation" | "Contrôle";
  description: string;
  cost: number;
}

export function MaterielView() {
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false); // État pour le modal stats
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["materiel-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Equipment["status"] }) => {
      const { error } = await supabase
        .from("equipment")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materiel-equipment"] });
      toast.success("Statut du matériel mis à jour");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["materiel-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Récupération de l'historique d'utilisation pour les graphiques (30 derniers jours)
  const { data: usageHistory = [] } = useQuery({
    queryKey: ["equipment-usage-30d"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("task_equipment")
        .select(`
          equipment_id,
          tasks!inner (
            finished_at,
            duration
          )
        `)
        .not("tasks.finished_at", "is", null)
        .gte("tasks.finished_at", thirtyDaysAgo);
      
      if (error) throw error;
      
      // Formatage simplifié pour le composant
      return data.map((item: any) => ({
        equipmentId: item.equipment_id,
        date: parseISO(item.tasks.finished_at),
        duration: Number(item.tasks.duration || 0)
      }));
    },
    enabled: !!equipment.length
  });

  const uniqueTypes = useMemo(() => {
    const types = new Set(equipment.map(e => e.type));
    return Array.from(types).sort();
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    let filtered = equipment;

    // Filtrage des alertes (Pannes ou Maintenance requise par les heures)
    if (showIssuesOnly) {
      filtered = filtered.filter(e => e.status !== "OK" || e.hours_used >= e.hours_for_maintenance);
    }

    // Filtrage par type
    if (filterType !== "all") {
      filtered = filtered.filter(e => e.type === filterType);
    }

    // Filtrage par terme de recherche
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (e.internal_id?.toLowerCase() || "").includes(lowerCaseSearchTerm) ||
        e.type.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    return filtered;
  }, [equipment, filterType, searchTerm, showIssuesOnly]);

  // Calcul des données du graphique pour l'engin sélectionné
  const chartData = useMemo(() => {
    if (!selected) return [];
    const last30Days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return last30Days.map(day => ({
      name: format(day, "dd MMM", { locale: fr }),
      heures: usageHistory
        .filter(h => h.equipmentId === selected.id && isSameDay(h.date, day))
        .reduce((sum, h) => sum + h.duration, 0)
    }));
  }, [selected, usageHistory]);

  const isFiltered = searchTerm !== "" || filterType !== "all" || showIssuesOnly;

  if (loadingEquipment) {
    return <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Chargement du parc matériel...</div>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold">Parc matériel & engins</h1>
        <p className="text-sm text-muted-foreground">Affectation, carnet de santé et maintenance préventive.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Tous types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant={showIssuesOnly ? "destructive" : "outline"} 
            size="sm" 
            onClick={() => setShowIssuesOnly(!showIssuesOnly)}
            className="gap-2 h-10 sm:h-9"
          >
            <AlertTriangle className={`h-4 w-4 ${showIssuesOnly ? "animate-pulse" : ""}`} />
            {showIssuesOnly ? "Voir tout le parc" : "Alertes uniquement"}
          </Button>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher matériel..." className="pl-9" />
          </div>
        </div>
      </div>

      {filteredEquipment.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="rounded-full bg-muted p-3">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {equipment.length === 0 ? "Le parc est vide" : "Aucun matériel trouvé"}
          </h3>
          <p className="mb-4 text-sm text-muted-foreground text-balance">
            {equipment.length === 0 
              ? "Commencez par ajouter du matériel ou générez les données de démonstration dans les Paramètres." 
              : "Modifiez vos filtres ou votre recherche pour trouver ce que vous cherchez."}
          </p>
          {isFiltered && (
            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(""); setFilterType("all"); setShowIssuesOnly(false); }}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredEquipment.map((e) => {
          const assignee = profiles.find((u) => u.id === e.assigned_to);
          const pct = Math.min(100, (e.hours_used / e.hours_for_maintenance) * 100);
          const danger = e.status !== "OK";
          const remainingHours = e.hours_for_maintenance - e.hours_used;

          return (
            <Card key={e.id} className={danger ? "border-destructive/40" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold leading-tight">
                      {e.internal_id && <span className="text-primary font-bold mr-1.5">{e.internal_id}</span>}
                      {e.name}
                    </div>
                    <Badge variant="outline" className="mt-1 text-[10px]">{e.type}</Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge 
                        variant={danger ? "destructive" : "secondary"}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {e.status}
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: e.id, status: "OK" })}>
                        ✅ Marquer opérationnel (OK)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: e.id, status: "Maintenance requise" })}>
                        ⚠️ Maintenance requise
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: e.id, status: "En panne" })}>
                        🚨 En panne
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {assignee && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" />
                    Affecté à {assignee.name}
                  </div>
                )}
                {e.team && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>Équipe : <span className="font-medium text-foreground">{e.team}</span></span>
                  </div>
                )}

                {/* Section Détails Techniques */}
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2 text-[10px]">
                  {e.serial_number && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Fingerprint className="h-3 w-3" />
                      <span className="truncate">S/N: <span className="text-foreground font-medium">{e.serial_number}</span></span>
                    </div>
                  )}
                  {e.registration_number && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CarFront className="h-3 w-3" />
                      <span className="truncate">Immat: <span className="text-foreground font-medium">{e.registration_number}</span></span>
                    </div>
                  )}
                  {e.motorization_type && e.motorization_type.trim() !== "" && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <Fuel className="h-3 w-3" />
                      <span>Moteur: <span className="text-foreground font-medium">{e.motorization_type}</span></span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">Compteur révision</span>
                    <span className="font-medium">{e.hours_used}h / {e.hours_for_maintenance}h</span>
                  </div>
                  <Progress value={pct} className={`h-1.5 ${pct > 95 ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : ""}`} />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider">
                    <span className="text-muted-foreground">Restant avant révision</span>
                    <span className={remainingHours <= 5 ? "text-destructive animate-pulse" : remainingHours <= 20 ? "text-warning" : "text-success"}>
                      {remainingHours > 0 ? `${remainingHours}h` : "Échéance dépassée"}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground border-t pt-2">
                  Dernier entretien : {e.last_maintenance ? format(parseISO(e.last_maintenance), "dd MMM yyyy", { locale: fr }) : "Aucun historique"}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(e)}>
                    <HistoryIcon className="mr-1.5 h-3.5 w-3.5" /> Carnet
                  </Button>
                  <Button variant="outline" size="sm" className="px-2" title="Statistiques" onClick={() => { setSelected(e); setStatsOpen(true); }}>
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => { setSelected(e); setLogOpen(true); }}>
                    <Wrench className="mr-1.5 h-3.5 w-3.5" /> Réviser
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal : Carnet d'entretien */}
      {selected && !logOpen && !statsOpen && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Carnet — {selected.name}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {maintenance.filter((m) => m.equipmentId === selected.id).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun entretien enregistré.</p>
              )}
              {maintenance.filter((m) => m.equipmentId === selected.id).map((m) => (
                <div key={m.id} className="rounded-md border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{m.type}</Badge>
                    <span className="text-xs text-muted-foreground">{format(parseISO(m.date), "dd MMM yyyy", { locale: fr })}</span>
                  </div>
                  <p className="mt-1">{m.description}</p>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">Coût : {m.cost.toFixed(2)} €</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal : Statistiques d'Utilisation */}
      {selected && statsOpen && (
        <Dialog open onOpenChange={() => { setStatsOpen(false); setSelected(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Utilisation 30 jours — {selected.name}
              </DialogTitle>
            </DialogHeader>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" fontSize={10} tick={{ fill: 'var(--muted-foreground)' }} />
                  <YAxis fontSize={10} tick={{ fill: 'var(--muted-foreground)' }} unit="h" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="heures" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.heures > 6 ? "rgb(239 68 68)" : "rgb(34 197 94)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-center text-muted-foreground italic">Les barres rouges indiquent une utilisation intensive (&gt; 6h/jour).</p>
          </DialogContent>
        </Dialog>
      )}

      {selected && logOpen && (
        <NewMaintenanceDialog equipment={selected} onClose={() => { setLogOpen(false); setSelected(null); }} onSave={(log) => {
          setMaintenance((prev) => [
            ...prev,
            {
              id: `m-${Date.now()}`,
              equipmentId: selected.id,
              date: log.date,
              type: log.type,
              description: log.description,
              cost: log.cost,
            },
          ]);
          toast.success("Entretien enregistré · compteur réinitialisé");
          setLogOpen(false); setSelected(null);
        }} />
      )}
    </div>
  );
}

function NewMaintenanceDialog({ equipment, onClose, onSave }: {
  equipment: Equipment; onClose: () => void;
  onSave: (l: { date: string; type: "Révision" | "Réparation" | "Contrôle"; description: string; cost: number }) => void;
}) {
  const [type, setType] = useState<"Révision" | "Réparation" | "Contrôle">("Révision");
  const [desc, setDesc] = useState(""); const [cost, setCost] = useState("0");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvel entretien — {equipment.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Révision">Révision</SelectItem>
                <SelectItem value="Réparation">Réparation</SelectItem>
                <SelectItem value="Contrôle">Contrôle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Description</label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Vidange, changement lame..." />
          </div>
          <div>
            <label className="text-sm">Coût (€)</label>
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave({ date: new Date().toISOString().slice(0, 10), type, description: desc, cost: parseFloat(cost) || 0 })}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

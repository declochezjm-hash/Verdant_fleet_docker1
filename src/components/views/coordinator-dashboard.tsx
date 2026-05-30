import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; // Fixed: ensure it's imported
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Package, Wrench, AlertTriangle, TrendingUp, Users, Download, FileText, Loader2, TrendingDown, Briefcase, Plus, X, Filter, History as HistoryIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { TaskCreateDialog } from "./task-create-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskWithDetails = {
  id: string;
  title: string;
  client: string;
  address: string;
  scheduled_at: string;
  duration: number;
  team: string;
  status: "planifie" | "en_cours" | "termine" | "annule";
  priority: "normale" | "haute" | "urgente";
  budget: number;
  labor_cost: number;
  finished_at: string | null;
  task_assignments: { profiles: { name: string } }[];
  task_products: { quantity: number; products: { name: string; amm_number: string | null; category: string; unit: string; price_per_unit: number } }[];
  task_equipment: { equipment: { name: string; hourly_cost: number } }[];
};

type ProductWithDetails = {
  id: string;
  name: string;
  amm_number: string | null;
  category: "Engrais" | "Phyto" | "Semences";
  unit: string;
  stock: number;
  threshold: number;
  price_per_unit: number;
};

type EquipmentWithDetails = {
  id: string;
  name: string;
  type: string;
  hours_used: number;
  hours_for_maintenance: number;
  status: "OK" | "Maintenance requise" | "En panne";
  profiles?: { name: string } | null;
};

/**
 * Retourne la variante de style Shadcn pour le badge en fonction du statut
 */
export const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "planifie":
      return "secondary";
    case "en_cours":
      return "default";
    case "termine":
      return "outline";
    case "annule":
      return "destructive";
    default:
      return "secondary";
  }
};

/**
 * Retourne la variante de style pour la priorité
 */
export const getPriorityVariant = (priority: string): "secondary" | "default" | "destructive" | "outline" => {
  switch (priority) {
    case "haute":
      return "default"; // Badge coloré (souvent bleu/vert selon le thème)
    case "urgente":
      return "destructive"; // Badge rouge
    case "normale":
    default:
      return "secondary"; // Badge gris
  }
};

export function CoordinatorDashboard() {
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // Correction de l'hydratation : On ne rend la date que sur le client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Récupération des équipes uniques définies dans les profils
  const { data: teams = [] } = useQuery({
    queryKey: ["company-teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("team")
        .not("team", "is", null);
      if (error) throw error;
      return Array.from(new Set(data.map(p => p.team))).filter(Boolean).sort() as string[];
    }
  });

  const { data: rawTasks, isLoading: isLoadingTasks } = useQuery<TaskWithDetails[]>({
    queryKey: ["dashboard-tasks"],
    staleTime: 1000 * 60 * 2, // 2 minutes de cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,title,client,address,scheduled_at,duration,team,status,priority,budget,labor_cost,finished_at,created_at,
          task_assignments(profiles(name)),
          task_products(quantity,products(name,amm_number,category,unit,price_per_unit)),
          task_equipment(equipment(name,hourly_cost))
        `)
        .neq("status", "annule") // Exclure les tâches annulées
        .order("scheduled_at", { ascending: false });
      if (error) {
        console.error("Erreur Supabase (Tasks):", error);
        throw error;
      }
      console.log("Données reçues de Supabase (Tasks):", data);
      return data as TaskWithDetails[];
    }
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery<ProductWithDetails[]>({
    queryKey: ["dashboard-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as ProductWithDetails[];
    }
  });

  const { data: equipment, isLoading: isLoadingEquipment } = useQuery<EquipmentWithDetails[]>({
    queryKey: ["dashboard-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*, profiles(name)")
        .order("name");
      if (error) throw error;
      return data as EquipmentWithDetails[];
    }
  });

  const allTasks = rawTasks || [];
  const allProducts = products || [];
  const allEquipment = equipment || [];

  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => {
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchesTeam = teamFilter === "all" || t.team === teamFilter;
      return matchesPriority && matchesTeam;
    });
  }, [allTasks, priorityFilter, teamFilter]);

  const todayTasks = useMemo(() => filteredTasks.filter((t) => isToday(parseISO(t.scheduled_at))), [filteredTasks]);
  const inProgress = useMemo(() => filteredTasks.filter((t) => t.status === "en_cours"), [filteredTasks]);
  const lowStock = useMemo(() => allProducts.filter((p) => p.stock <= p.threshold), [allProducts]);
  const maintenanceAlerts = useMemo(() => allEquipment.filter((e) => e.status !== "OK"), [allEquipment]);

  const processedTasks = useMemo(() => filteredTasks.map(t => {
    const supplies = (t.task_products || []).reduce((sum: number, tp: any) =>
      sum + (Number(tp.quantity) * Number(tp.products?.price_per_unit || 0)), 0) || 0;
    const equipCost = (t.task_equipment || []).reduce((sum: number, te: any) =>
      sum + (Number(te.equipment?.hourly_cost || 0) * (Number(t.duration) || 0)), 0) || 0;
    const labor = Number(t.labor_cost || 0);
    const total = labor + supplies + equipCost;
    const margin = Number(t.budget || 0) - total;
    return { ...t, supplies, equipCost, labor, total, margin };
  }), [filteredTasks]);

  const completedProcessedTasks = useMemo(() => processedTasks.filter(t => t.status === "termine"), [processedTasks]);

  const totalBudget = useMemo(() => processedTasks.reduce((acc, t) => acc + Number(t.budget || 0), 0), [processedTasks]);
  const totalActual = useMemo(() => processedTasks.reduce((acc, t) => acc + (Number(t.total) || 0), 0), [processedTasks]);

  const siteCosts = useMemo(() => {
    const clientMap = new Map<string, number>();
    completedProcessedTasks.forEach(t => {
      const currentCost = clientMap.get(t.client) || 0;
      clientMap.set(t.client, currentCost + t.total);
    });
    return Array.from(clientMap.entries())
      .map(([name, cost]) => ({ name: String(name || "Client inconnu"), Coût: Math.round(cost || 0) }))
      .sort((a, b) => b.Coût - a.Coût);
  }, [completedProcessedTasks]);

  const hasPhytoData = useMemo(() => 
    completedProcessedTasks.some(t => t.task_products?.some(tp => tp.products?.category === "Phyto")),
    [completedProcessedTasks]
  );

  const exportPhytoRegistry = () => {
    const phytoEntries = completedProcessedTasks.flatMap(t =>
      t.task_products
        .filter(tp => tp.products?.category === "Phyto")
        .map(tp => {
          const agentName = t.task_assignments?.[0]?.profiles?.name || "N/A";
          const date = t.finished_at || t.created_at;
          const dateStr = date ? format(parseISO(date), "dd/MM/yyyy") : "N/A";
          return [dateStr, t.title, tp.products?.name, tp.products?.amm_number || 'N/A', tp.quantity, tp.products?.unit, agentName].join(";");
        })
    );

    if (phytoEntries.length === 0) {
      toast.error("Aucune application phytosanitaire enregistrée pour l'export.");
      return;
    }

    const head = "Date;Chantier;Produit;AMM;Quantité;Unité;Applicateur\n";
    const body = phytoEntries.join("\n");
    const blob = new Blob(["\ufeff" + head + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registre_phyto_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Registre phytosanitaire exporté (CSV)");
  };

  const teamLoad = useMemo(() => teams.map((team) => ({
    name: team,
    Heures: Math.round(filteredTasks.filter((t) => t.team === team && t.status !== "termine").reduce((s, t) => s + (Number(t.duration) || 0), 0)),
  })), [filteredTasks, teams]);

  const stockByCat = useMemo(() => ["Engrais", "Phyto", "Semences"].map((cat) => ({
    name: cat,
    value: allProducts.filter((p) => p.category === cat).reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.price_per_unit) || 0), 0),
  })), [allProducts]);

  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)"];

  if (isLoadingTasks || isLoadingProducts || isLoadingEquipment) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            {mounted ? format(new Date(), "EEEE d MMMM yyyy", { locale: fr }) : "..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-[150px] shadow-sm">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-[150px] shadow-sm">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Équipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les équipes</SelectItem>
              {teams.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TaskCreateDialog 
            trigger={
              <Button variant="outline" className="gap-2 shadow-sm"><Plus className="h-4 w-4" /> Nouveau chantier</Button>
            } 
          />
          <Button asChild className="gap-2 shadow-sm">
            <Link to="/coordinator">
              <Briefcase className="h-4 w-4" /> Gestion complète
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={totalActual > totalBudget ? TrendingDown : TrendingUp} label="Réel vs Budget" value={`${totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0}%`} accent={totalActual > totalBudget ? "destructive" : "primary"} />
        <StatCard icon={Wrench} label="Réparations en attente" value={maintenanceAlerts.filter(e => e.status === "En panne").length} accent="destructive" />
        <StatCard icon={Package} label="Stocks critiques" value={lowStock.length} accent="warning" />
        <StatCard icon={FileText} label="Chantiers à valider" value={inProgress.length} accent="accent" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comptabilité Analytique : Coût par Site</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] min-w-0">
            {siteCosts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={siteCosts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="Coût" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Aucune donnée de coût disponible</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Inventaire & Réglementation</CardTitle>
            <Button onClick={exportPhytoRegistry} size="sm" variant="outline" className="gap-2" disabled={!hasPhytoData}>
              <Download className="h-4 w-4" /> Registre Phyto
            </Button>
          </CardHeader>
        <CardContent className="h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
                <Pie data={stockByCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {stockByCat.map((_, i) => (<Cell key={i} fill={COLORS[i]} />))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(0)} €`} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Chantiers du jour</CardTitle>
            <Button asChild size="sm" variant="outline"><Link to="/planning">Voir le planning</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 && <p className="text-sm text-muted-foreground">Aucun chantier programmé aujourd'hui.</p>}
            {todayTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-base">Charge des équipes (semaine)</CardTitle></CardHeader>
          <CardContent className="h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={teamLoad} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="Heures" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(lowStock.length > 0 || maintenanceAlerts.length > 0) && (
        <Card className="border-warning/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertes critiques
            </CardTitle>
              <Button asChild size="sm" variant="ghost" className="text-xs gap-1">
              <Link to="/anomalies">
                <HistoryIcon className="h-3.5 w-3.5" /> Voir le journal des anomalies
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Stocks bas</div>
              <div className="space-y-1.5">
                {lowStock.map((p: ProductWithDetails) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border bg-card p-2 text-sm">
                    <span>{p.name}</span>
                    <Badge variant="outline" className="border-warning text-warning">{p.stock} {p.unit} / seuil {p.threshold}</Badge>
                  </div>
                ))}
                {lowStock.length === 0 && <p className="text-sm text-muted-foreground">RAS</p>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Maintenance</div>
              <div className="space-y-1.5">
                {maintenanceAlerts.map((e: EquipmentWithDetails) => {
                  const pct = Math.min(100, (e.hours_used / e.hours_for_maintenance) * 100);
                  return (
                    <div key={e.id} className="rounded-md border bg-card p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-medium">{e.name}</span>
                          <span className="text-[10px] text-muted-foreground italic">
                            {e.profiles?.name ? `Affecté à ${e.profiles.name}` : "Non affecté"}
                          </span>
                        </div>
                        <Badge variant={e.status === "En panne" ? "destructive" : "warning"}>{e.status}</Badge>
                      </div>
                      <Progress value={pct} className="mt-1.5 h-1.5" />
                      <div className="mt-1 text-xs text-muted-foreground">{e.hours_used}h / {e.hours_for_maintenance}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent: "primary" | "accent" | "warning" | "destructive" | "muted" }) {
  const cls = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[accent];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: TaskWithDetails }) {
  const agentName = task.task_assignments?.[0]?.profiles?.name || "Non assigné";
  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{task.title}</span>
          <Badge variant={getStatusVariant(task.status)} className="text-[10px] uppercase">
            {task.status === "planifie" ? "planifié" : task.status === "en_cours" ? "en cours" : task.status}
          </Badge>
          {task.priority && task.priority !== "normale" && (
            <Badge variant={getPriorityVariant(task.priority)} className="text-[10px] uppercase">{task.priority}</Badge>
          )}
        </div> 
        <div className="mt-0.5 text-xs text-muted-foreground truncate">
          {task.client} · {format(parseISO(task.scheduled_at), "HH'h'mm")} · {agentName}
        </div>
      </div>
      <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, Loader2, Eye, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { TaskDetailsSheet } from "./task-details-sheet";
import { TaskCreateDialog } from "./task-create-dialog";

export function AdminAnalytics() {
  const [team, setTeam] = useState("all");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Récupération des données réelles depuis Supabase
  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ["admin-analytics-tasks"],
    staleTime: 1000 * 60 * 5, // Garder les données fraîches 5 minutes
    gcTime: 1000 * 60 * 30, // Conserver en cache 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_products (
            quantity,
            products (price_per_unit)
          ),
          task_equipment (
            equipment (hourly_cost)
          )
        `)
        .eq("status", "termine");
      if (error) throw error;
      return data;
    }
  });

  // Récupération des équipes réelles pour le filtre
  const { data: teams = [] } = useQuery({
    queryKey: ["teams-list-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("name, overhead_labor_pct, overhead_equip_pct, overhead_mat_pct").eq("is_archived", false).order("name");
      if (error) throw error;
      return data;
    }
  });

  const completed = useMemo(() => rawTasks.filter((t) => team === "all" || t.team === team), [rawTasks, team]);

  const rows = useMemo(() => completed.map((t) => {
    const teamConfig = teams.find(tm => tm.name === t.team);

    // 1. Coûts Directs (Déboursé Sec)
    const supplies_direct = t.task_products?.reduce((sum: number, tp: any) => 
      sum + ((Number(tp.quantity) || 0) * (Number(tp.products?.price_per_unit) || 0)), 0) || 0;
    
    const equip_direct = t.task_equipment?.reduce((sum: number, te: any) => 
      sum + ((Number(te.equipment?.hourly_cost) || 0) * (Number(t.duration) || 0)), 0) || 0;

    const labor_direct = Number(t.labor_cost || 0);
    const total_direct = labor_direct + supplies_direct + equip_direct;

    // 2. Coûts Chargés (Application des coefficients de gestion)
    const labor_charged = labor_direct * (1 + (teamConfig?.overhead_labor_pct || 0) / 100);
    const equip_charged = equip_direct * (1 + (teamConfig?.overhead_equip_pct || 0) / 100);
    const supplies_charged = supplies_direct * (1 + (teamConfig?.overhead_mat_pct || 0) / 100);
    
    const total_charged = labor_charged + equip_charged + supplies_charged;
    
    // 3. Marges
    const margin_gross = Number(t.budget || 0) - total_direct;
    const margin_net = Number(t.budget || 0) - total_charged;

    return { 
      task: t, 
      labor: labor_charged, 
      supplies: supplies_charged, 
      equip: equip_charged, 
      total: total_charged, 
      margin: margin_net,
      gross_margin: margin_gross
    };
  }), [completed, teams]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    budget: acc.budget + Number(r.task.budget || 0), labor: acc.labor + r.labor,
    supplies: acc.supplies + r.supplies, equip: acc.equip + r.equip,
    total: acc.total + r.total, margin: acc.margin + r.margin,
  }), { budget: 0, labor: 0, supplies: 0, equip: 0, total: 0, margin: 0 }), [rows]);

  const chart = useMemo(() => rows.map((r) => ({ name: (r.task.title || "Sans titre").slice(0, 12), "MO Chargée": Math.round(r.labor), "Fournit. Chargées": Math.round(r.supplies), "Matos Chargé": Math.round(r.equip) })), [rows]);

  const exportCsv = () => {
    const safeDate = (dateStr: string | null) => {
      try { return dateStr ? format(parseISO(dateStr), "dd/MM/yyyy") : "—"; } catch { return "—"; }
    };
    const head = "Date;N° Chantier;Chantier;Client;Équipe;Budget;Main d'oeuvre;Fournitures;Matériel;Coût total;Marge\n";
    const body = rows.map((r) =>
      [safeDate(r.task.finished_at ?? r.task.created_at), r.task.project_number || "", r.task.title, r.task.client, r.task.team,
       Number(r.task.budget).toFixed(2), r.labor.toFixed(2), r.supplies.toFixed(2), r.equip.toFixed(2), r.total.toFixed(2), r.margin.toFixed(2)
      ].join(";")
    ).join("\n");
    const blob = new Blob(["\ufeff" + head + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analytique-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export comptabilité téléchargé");
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptabilité analytique</h1>
          <p className="text-sm text-muted-foreground">Coût de revient par chantier (MO + fournitures + amortissement matériel).</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes équipes</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export compta</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Chiffre d'Affaires" value={totals.budget} />
        <Stat label="Prix de Revient" value={totals.total} sub="Coûts + Frais de gestion" />
        <Stat label="Main d'œuvre" value={totals.labor} sub="MO chargée" />
        <Stat label="Marge Nette" value={totals.margin} highlight />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Répartition des coûts par chantier</CardTitle></CardHeader>
        <CardContent className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="MO Chargée" stackId="a" fill="var(--chart-1)" />
              <Bar dataKey="Fournit. Chargées" stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="Matos Chargé" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Détail par chantier</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Chantier</th>
                  <th className="px-2 py-2 text-right">Budget</th>
                  <th className="px-2 py-2 text-right">MO (+fg)</th>
                  <th className="px-2 py-2 text-right">Prod (+fg)</th>
                  <th className="px-2 py-2 text-right">Matos (+fg)</th>
                  <th className="px-2 py-2 text-right">P. Revient</th>
                  <th className="px-2 py-2 text-right">Marge Nette</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Aucun chantier terminé.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.task.id} className="border-b">
                    <td className="px-2 py-2 text-xs">{format(parseISO(r.task.finished_at ?? r.task.created_at), "dd/MM/yy")}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        {r.task.project_number && <span className="text-[10px] text-muted-foreground font-mono">[{r.task.project_number}]</span>}
                        {r.task.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.task.client} · {r.task.team}</div>
                    </td>
                    <td className="px-2 py-2 text-right">{Number(r.task.budget).toFixed(0)} €</td>
                    <td className="px-2 py-2 text-right">{r.labor.toFixed(0)} €</td>
                    <td className="px-2 py-2 text-right">{r.supplies.toFixed(0)} €</td>
                    <td className="px-2 py-2 text-right">{r.equip.toFixed(0)} €</td>
                    <td className="px-2 py-2 text-right font-semibold">{r.total.toFixed(0)} €</td>
                    <td className="px-2 py-2 text-right">
                      <Badge variant={r.margin >= 0 ? "secondary" : "destructive"} className={r.margin >= 0 ? "bg-success/20 text-success-foreground" : ""}>
                        {r.margin >= 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        {r.margin.toFixed(0)} €
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={() => setOpenTaskId(r.task.id)}
                          title="Voir les détails"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <TaskCreateDialog 
                          taskId={r.task.id}
                          trigger={
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? (value >= 0 ? "border-success/40" : "border-destructive/40") : ""}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${highlight ? (value >= 0 ? "text-success" : "text-destructive") : ""}`}>
          {value.toFixed(0)} €
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

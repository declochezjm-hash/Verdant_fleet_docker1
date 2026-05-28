import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";

export function AdminAnalytics() {
  const [team, setTeam] = useState("all");

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

  const completed = useMemo(() => rawTasks.filter((t) => team === "all" || t.team === team), [rawTasks, team]);

  const rows = useMemo(() => completed.map((t) => {
    // Calcul des fournitures via les jointures
    const supplies = t.task_products?.reduce((sum: number, tp: any) => 
      sum + ((Number(tp.quantity) || 0) * (Number(tp.products?.price_per_unit) || 0)), 0) || 0;
    
    // Sécurisation du calcul matériel contre les valeurs NaN/Null
    const equip = t.task_equipment?.reduce((sum: number, te: any) => 
      sum + ((Number(te.equipment?.hourly_cost) || 0) * (Number(t.duration) || 0)), 0) || 0;

    const labor = Number(t.labor_cost || 0);
    const total = labor + supplies + equip;
    const margin = Number(t.budget || 0) - total;

    return { task: t, labor, supplies, equip, total, margin };
  }), [completed]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    budget: acc.budget + Number(r.task.budget || 0), labor: acc.labor + r.labor,
    supplies: acc.supplies + r.supplies, equip: acc.equip + r.equip,
    total: acc.total + r.total, margin: acc.margin + r.margin,
  }), { budget: 0, labor: 0, supplies: 0, equip: 0, total: 0, margin: 0 }), [rows]);

  const chart = useMemo(() => rows.map((r) => ({ name: (r.task.title || "Sans titre").slice(0, 12), MO: Math.round(r.labor), Fournitures: Math.round(r.supplies), Matériel: Math.round(r.equip) })), [rows]);

  const exportCsv = () => {
    const safeDate = (dateStr: string | null) => {
      try { return dateStr ? format(parseISO(dateStr), "dd/MM/yyyy") : "—"; } catch { return "—"; }
    };
    const head = "Date;Chantier;Client;Équipe;Budget;Main d'oeuvre;Fournitures;Matériel;Coût total;Marge\n";
    const body = rows.map((r) =>
      [safeDate(r.task.finished_at ?? r.task.created_at), r.task.title, r.task.client, r.task.team,
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
              <SelectItem value="Équipe Nord">Équipe Nord</SelectItem>
              <SelectItem value="Équipe Sud">Équipe Sud</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export compta</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Budget total" value={totals.budget} />
        <Stat label="Coût réel" value={totals.total} />
        <Stat label="Main d'œuvre" value={totals.labor} sub="Coût chargé réel" />
        <Stat label="Marge" value={totals.margin} highlight />
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
              <Bar dataKey="MO" stackId="a" fill="var(--chart-1)" />
              <Bar dataKey="Fournitures" stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="Matériel" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
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
                  <th className="px-2 py-2 text-right">MO</th>
                  <th className="px-2 py-2 text-right">Fournit.</th>
                  <th className="px-2 py-2 text-right">Matériel</th>
                  <th className="px-2 py-2 text-right">Coût total</th>
                  <th className="px-2 py-2 text-right">Marge</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">Aucun chantier terminé.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.task.id} className="border-b">
                    <td className="px-2 py-2 text-xs">{format(parseISO(r.task.finished_at ?? r.task.created_at), "dd/MM/yy")}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.task.title}</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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

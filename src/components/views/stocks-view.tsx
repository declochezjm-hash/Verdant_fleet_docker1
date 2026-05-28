import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Search, Loader2, Plus, Download, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  amm_number: string | null;
  category: "Engrais" | "Phyto" | "Semences";
  unit: "L" | "Kg" | "Sac";
  stock: number;
  threshold: number;
  price_per_unit: number;
}

export function StocksView() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState("");

  // 1. Récupération des produits depuis Supabase
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Product[];
    }
  });

  // 2. Récupération du registre phytosanitaire (jointure task_products -> tasks -> profiles)
  const { data: phytoEntries = [], isLoading: loadingPhyto } = useQuery({
    queryKey: ["phyto-registry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_products")
        .select(`
          id,
          quantity,
          lot_number,
          dose_per_m2,
          created_at,
          products!inner (name, category, unit, amm_number),
          tasks (
            title, 
            client, 
            finished_at,
            task_assignments (profiles (name))
          )
        `)
        .eq("products.category", "Phyto")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // 3. Mutation pour ajustement manuel (réapprovisionnement)
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, newStock }: { id: string, newStock: number }) => {
      if (newStock < 0) throw new Error("Le stock ne peut pas être négatif");
      
      const { error } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock mis à jour");
      setAdjustingId(null);
      setAdjustmentValue("");
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const exportPhytoCSV = () => {
    if (phytoEntries.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const head = "Date;Chantier;Produit;AMM;Quantité;Unité;Lot;Dose;Applicateur\n";
    const body = (phytoEntries as any[]).map((e) => {
      const task = e.tasks;
      const agent = task?.task_assignments?.[0]?.profiles?.name || "N/A";
      const date = task?.finished_at || e.created_at;
      const dateStr = format(parseISO(date), "dd/MM/yyyy");
      
      return [
        dateStr, task?.title || "—", e.products?.name, e.products?.amm_number || "N/A",
        e.quantity, e.products.unit, e.lot_number || "—", e.dose_per_m2 || "—", agent
      ].join(";");
    }).join("\n");

    const blob = new Blob(["\ufeff" + head + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registre_phyto_detail_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Registre détaillé exporté");
  };

  const filtered = useMemo(() => {
    return products.filter((p) =>
      (cat === "all" || p.category === cat) && 
      p.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [products, cat, q]);

  if (loadingProducts) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Stocks & Registre phytosanitaire</h1>
        <p className="text-sm text-muted-foreground">Inventaire des produits et traçabilité légale des doses appliquées.</p>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventaire</TabsTrigger>
          <TabsTrigger value="registry">Registre phyto</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit..." className="pl-8" />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="Engrais">Engrais</SelectItem>
                <SelectItem value="Phyto">Phytosanitaires</SelectItem>
                <SelectItem value="Semences">Semences</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const pct = Math.min(100, (Number(p.stock) / (Number(p.threshold) * 3)) * 100);
              const low = p.stock <= p.threshold;
              return (
                <Card key={p.id} className={`${low ? "border-warning/60 bg-warning/5" : ""} transition-all`}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold leading-tight">{p.name}</div>
                        <Badge variant="outline" className="mt-1 text-[10px]">{p.category}</Badge>
                      </div>
                      {low ? (
                        <Badge variant="destructive" className="animate-pulse">Stock Bas</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-success/10 text-success-foreground border-success/20">OK</Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{p.stock}</span>
                      <span className="text-sm text-muted-foreground">{p.unit}</span>
                    </div>
                    <Progress value={pct} className={`h-1.5 ${low ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Seuil : {p.threshold} {p.unit}</span>
                      <span>{Number(p.price_per_unit).toFixed(2)} €/{p.unit}</span>
                    </div>
                    
                    <div className="pt-2">
                      {adjustingId === p.id ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            size={1} 
                            className="h-8 text-xs font-bold" 
                            placeholder="Nouv. stock" 
                            value={adjustmentValue}
                            onChange={(e) => setAdjustmentValue(e.target.value)}
                            min="0"
                          />
                          <Button 
                            size="sm" 
                            className="h-8" 
                            disabled={updateStockMutation.isPending || adjustmentValue === "" || Number(adjustmentValue) < 0}
                            onClick={() => updateStockMutation.mutate({ id: p.id, newStock: Number(adjustmentValue) })}
                          >
                            {updateStockMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdjustingId(null)}>Annuler</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full text-[10px] h-7 gap-1" onClick={() => { setAdjustingId(p.id); setAdjustmentValue(String(p.stock)); }}>
                          <Plus className="h-3 w-3" /> Ajuster le stock
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="registry">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Registre phytosanitaire</CardTitle>
                <p className="text-xs text-muted-foreground">Conservation obligatoire 5 ans. Traçabilité des doses et lots.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportPhytoCSV} disabled={phytoEntries.length === 0}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loadingPhyto ? (
                <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Chantier</th>
                      <th className="px-2 py-2">Produit</th>
                      <th className="px-2 py-2">Quantité</th>
                      <th className="px-2 py-2">Lot / Dose</th>
                      <th className="px-2 py-2">Applicateur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phytoEntries.length === 0 ? (
                      <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">Aucune application enregistrée</td></tr>
                    ) : phytoEntries.map((e: any, i) => {
                      const task = e.tasks;
                      const agent = task?.task_assignments?.[0]?.profiles?.name || "N/A";
                      const date = task?.finished_at || e.created_at;

                      return (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-2 text-xs">{format(parseISO(date), "dd/MM/yyyy", { locale: fr })}</td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{task?.title || "—"}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{task?.client}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{e.products.name}</div>
                            <div className="text-[10px] text-muted-foreground">AMM: {e.products.amm_number || "N/A"}</div>
                          </td>
                          <td className="px-2 py-2"><Badge variant="secondary">{e.quantity} {e.products.unit}</Badge></td>
                          <td className="px-2 py-2">
                             <div className="text-[10px] uppercase font-bold text-muted-foreground">Lot: {e.lot_number || "—"}</div>
                             <div className="text-[10px] text-muted-foreground">{e.dose_per_m2 ? `${e.dose_per_m2}/m²` : ""}</div>
                          </td>
                          <td className="px-2 py-2 text-xs">{agent}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

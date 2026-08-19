import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildProductPageContext, useVerduraPageContextSetter } from "@/lib/verdura-page-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Search, Loader2, Plus, Download, History as HistoryIcon, TrendingUp, ShoppingCart, Receipt, Factory, FileSpreadsheet, X, Trash2, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  const { setPageContext } = useVerduraPageContextSetter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState("");

  // États pour la gestion CRUD (Création/Edition)
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);

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

  // Récupération des Fournisseurs
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  // 4. Récupération des Commandes et Factures
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // 5. Récupération des Clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) return [];
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

  // Mutations CRUD
  const upsertProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Fiche produit enregistrée");
      setIsProductDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  useEffect(() => {
    if (isProductDialogOpen && editingProduct?.id) {
      setPageContext(buildProductPageContext(editingProduct as Product));
      return () => setPageContext(null);
    }
    if (!isProductDialogOpen) {
      setPageContext(null);
    }
    return undefined;
  }, [isProductDialogOpen, editingProduct, setPageContext]);

  // --- Composant Formulaire Commande interne ---
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    supplierId: "",
    items: [] as { productId: string; quantity: number; unitPrice: number }[]
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!newOrder.supplierId || newOrder.items.length === 0) throw new Error("Données incomplètes");
      
      const totalAmount = newOrder.items.reduce((acc, i) => acc + (i.quantity * i.unitPrice), 0);
      
      // 1. Créer la commande
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({ supplier_id: newOrder.supplierId, total_amount: totalAmount, status: 'envoye' })
        .select().single();
      if (orderError) throw orderError;

      // 2. Créer les articles
      const itemsToInsert = newOrder.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice
      }));
      const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Bon de commande généré et envoyé.");
      setIsOrderDialogOpen(false);
      setNewOrder({ supplierId: "", items: [] });
    },
    onError: (err: Error) => toast.error(err.message)
  });

  // Mutation pour changer le statut d'une commande (déclenche le trigger SQL de stock)
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Statut mis à jour et stock synchronisé !");
    }
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

  // Calculs analytiques
  const stockAnalytics = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + (p.stock * p.price_per_unit), 0);
    const toOrder = products.filter(p => p.stock <= p.threshold);
    const valByCategory = ["Engrais", "Phyto", "Semences"].map(c => ({
      name: c,
      value: products.filter(p => p.category === c).reduce((acc, p) => acc + (p.stock * p.price_per_unit), 0)
    }));

    return { totalValue, toOrder, valByCategory };
  }, [products]);

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
          <TabsTrigger value="analytics">Analytique & Achats</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row items-end sm:items-center">
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
            <Button onClick={() => { 
              setEditingProduct({ name: '', category: 'Engrais', unit: 'L', stock: 0, threshold: 0, price_per_unit: 0 }); 
              setIsProductDialogOpen(true); 
            }}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau Produit
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const pct = Math.min(100, (Number(p.stock) / (Number(p.threshold) * 3)) * 100);
              const low = p.stock <= p.threshold;
              return (
                <Card key={p.id} className={`${low ? "border-warning/60 bg-warning/5" : ""} transition-all group relative`}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold leading-tight">{p.name}</div>
                        <Badge variant="outline" className="mt-1 text-[10px]">{p.category}</Badge>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditingProduct(p); setIsProductDialogOpen(true); }}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          {low ? (
                            <Badge variant="destructive" className="animate-pulse">Stock Bas</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/10 text-success-foreground border-success/20">OK</Badge>
                          )}
                        </div>
                      </div>
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

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5">
              <CardContent className="p-4 flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{stockAnalytics.totalValue.toFixed(0)} €</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Valeur du Stock</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-4">
                <ShoppingCart className="h-8 w-8 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold text-amber-700">{stockAnalytics.toOrder.length}</div>
                  <div className="text-xs text-amber-600 uppercase font-bold">Produits à commander</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{invoices.filter(i => i.status === 'en_attente').length}</div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Factures en attente</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Répartition de la valeur</CardTitle></CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockAnalytics.valByCategory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Préparation Commande</CardTitle>
                <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] uppercase font-bold">
                      <Plus className="mr-1 h-3 w-3" /> Créer Bon de Commande
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Nouveau Bon de Commande</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Fournisseur</Label>
                        <Select value={newOrder.supplierId} onValueChange={(val) => setNewOrder({...newOrder, supplierId: val})}>
                          <SelectTrigger><SelectValue placeholder="Choisir un fournisseur..." /></SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Produit à ajouter</Label>
                        <Select onValueChange={(val) => {
                          const p = products.find(x => x.id === val);
                          if (p && !newOrder.items.find(i => i.productId === val)) {
                            setNewOrder({...newOrder, items: [...newOrder.items, { productId: val, quantity: 1, unitPrice: p.price_per_unit }]});
                          }
                        }}>
                          <SelectTrigger><SelectValue placeholder="Ajouter un produit..." /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/20">
                        {newOrder.items.map((item, idx) => (
                          <div key={item.productId} className="flex items-center gap-2 bg-background p-2 rounded border shadow-sm">
                            <span className="text-xs font-bold flex-1 truncate">{products.find(p => p.id === item.productId)?.name}</span>
                            <Input 
                              type="number" 
                              className="w-16 h-8 text-xs" 
                              value={item.quantity} 
                              onChange={(e) => {
                                const items = [...newOrder.items];
                                items[idx].quantity = parseFloat(e.target.value) || 0;
                                setNewOrder({...newOrder, items});
                              }}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                              setNewOrder({...newOrder, items: newOrder.items.filter(i => i.productId !== item.productId)});
                            }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {newOrder.items.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 italic">Aucun article</p>}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="w-full" disabled={createOrderMutation.isPending} onClick={() => createOrderMutation.mutate()}>
                        {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer la commande"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {stockAnalytics.toOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-8">Tous les stocks sont au dessus du seuil.</p>
                ) : (
                  stockAnalytics.toOrder.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/20">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{p.name}</span>
                        <span className="text-[10px] text-destructive font-medium uppercase">Stock: {p.stock} (Seuil: {p.threshold})</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20">Recommandé: {(p.threshold * 2 - p.stock).toFixed(0)} {p.unit}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Bons de Commande en cours</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase text-muted-foreground font-bold">
                      <th className="px-2 py-2">Fournisseur</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Statut</th>
                      <th className="px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground italic">Aucune commande enregistrée.</td></tr>
                    ) : (
                      purchaseOrders.map((o: any) => (
                        <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-2 py-3 font-medium">{o.suppliers?.name || "Inconnu"}</td>
                          <td className="px-2 py-3 text-xs">{format(parseISO(o.created_at), "dd/MM/yy")}</td>
                          <td className="px-2 py-3 font-bold">{Number(o.total_amount).toFixed(2)} €</td>
                          <td className="px-2 py-3">
                            <Badge 
                              variant={o.status === 'recu' ? 'outline' : o.status === 'envoye' ? 'default' : 'secondary'} 
                              className="text-[9px] uppercase"
                            >
                              {o.status}
                            </Badge>
                          </td>
                          <td className="px-2 py-3 text-right">
                            {o.status === 'envoye' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] uppercase font-bold text-success hover:text-success hover:bg-success/10"
                                onClick={() => updateOrderStatusMutation.mutate({ id: o.id, status: 'recu' })}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                {updateOrderStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Réceptionner"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Suivi des Factures Achat</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase text-muted-foreground font-bold">
                      <th className="px-2 py-2">N° Facture</th>
                      <th className="px-2 py-2">Échéance</th>
                      <th className="px-2 py-2">Montant</th>
                      <th className="px-2 py-2">Statut</th>
                      <th className="px-2 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground italic">Aucune facture enregistrée.</td></tr>
                    ) : (
                      invoices.map(i => (
                        <tr key={i.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-2 py-3 font-medium">{i.invoice_number}</td>
                          <td className="px-2 py-3 text-xs">{i.due_date ? format(parseISO(i.due_date), "dd/MM/yy") : "—"}</td>
                          <td className="px-2 py-3 font-bold">{Number(i.amount).toFixed(2)} €</td>
                          <td className="px-2 py-3">
                            <Badge variant={i.status === 'paye' ? 'outline' : 'destructive'} className="text-[9px] uppercase">
                              {i.status === 'paye' ? 'Payé' : 'À payer'}
                            </Badge>
                          </td>
                          <td className="px-2 py-3 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><FileSpreadsheet className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProduct?.id ? 'Modifier' : 'Nouveau'} Produit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2"><Label>Nom</Label><Input value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Catégorie</Label>
                <Select value={editingProduct?.category} onValueChange={v => setEditingProduct({...editingProduct, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engrais">Engrais</SelectItem>
                    <SelectItem value="Phyto">Phytosanitaires</SelectItem>
                    <SelectItem value="Semences">Semences</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Unité</Label>
                <Select value={editingProduct?.unit} onValueChange={v => setEditingProduct({...editingProduct, unit: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Litre (L)</SelectItem>
                    <SelectItem value="Kg">Kilogramme (Kg)</SelectItem>
                    <SelectItem value="Sac">Sac</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Seuil d'alerte</Label><Input type="number" value={editingProduct?.threshold || 0} onChange={e => setEditingProduct({...editingProduct, threshold: parseFloat(e.target.value) || 0})} /></div>
              <div className="grid gap-2"><Label>Prix (€/{editingProduct?.unit})</Label><Input type="number" step="0.01" value={editingProduct?.price_per_unit || 0} onChange={e => setEditingProduct({...editingProduct, price_per_unit: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid gap-2"><Label>N° AMM</Label><Input value={editingProduct?.amm_number || ''} onChange={e => setEditingProduct({...editingProduct, amm_number: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => upsertProductMutation.mutate(editingProduct)} disabled={upsertProductMutation.isPending}>
              {upsertProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

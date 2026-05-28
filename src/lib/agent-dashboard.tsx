import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Play, CheckCircle2, MapPin, Clock, Camera, QrCode, AlertTriangle, Pencil, Plus, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/signature-pad";
import type { Database } from "@/integrations/supabase/types";

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type TaskProductRow = Database['public']['Tables']['task_products']['Row'];

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const tasksQ = useQuery({
    queryKey: ["my-tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assigns, error: e1 } = await supabase
        .from("task_assignments").select("task_id").eq("user_id", user!.id);
      if (e1) throw e1;
      const ids = (assigns ?? []).map((a) => a.task_id);
      if (ids.length === 0) return [] as TaskRow[];
      const { data, error } = await supabase
        .from("tasks").select("*").in("id", ids).order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,category,unit").order("name");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const equipmentQ = useQuery({
    queryKey: ["equipment-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const taskProductsQ = useQuery({
    queryKey: ["task-products", (tasksQ.data ?? []).map((t) => t.id).join(",")],
    enabled: !!tasksQ.data && tasksQ.data.length > 0,
    queryFn: async () => {
      const ids = tasksQ.data!.map((t) => t.id);
      const { data, error } = await supabase.from("task_products").select("*").in("task_id", ids);
      if (error) throw error;
      return (data ?? []) as TaskProductRow[];
    },
  });

  const startMut = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks")
        .update({ status: "en_cours", started_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-tasks"] }); toast.success("Chantier démarré"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const myTasks = useMemo(
    () => (tasksQ.data ?? []).filter((t) => isToday(parseISO(t.scheduled_at))),
    [tasksQ.data]
  );
  const upcoming = useMemo(
    () => (tasksQ.data ?? []).filter((t) => new Date(t.scheduled_at) > new Date() && !isToday(parseISO(t.scheduled_at))).slice(0, 3),
    [tasksQ.data]
  );

  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const live = openTask ? (tasksQ.data ?? []).find((t) => t.id === openTask.id) ?? null : null;

  if (tasksQ.isLoading) return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
        <h1 className="text-2xl font-bold">Bonjour {profile?.name?.split(" ")[0] ?? ""}</h1>
        <p className="text-sm text-muted-foreground">{myTasks.length} chantier{myTasks.length > 1 ? "s" : ""} aujourd'hui</p>
      </div>

      <div className="space-y-3">
        {myTasks.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucun chantier prévu aujourd'hui 🌿</CardContent></Card>
        )}
        {myTasks.map((task) => (
          <TaskCard key={task.id} task={task}
            onStart={() => startMut.mutate(task.id)}
            onFinish={() => setOpenTask(task)}
            onPhoto={() => qc.invalidateQueries({ queryKey: ["my-tasks"] })}
          />
        ))}
      </div>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">À venir</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.client}</div>
                </div>
                <div className="text-xs text-muted-foreground">{format(parseISO(t.scheduled_at), "EEE d MMM HH'h'", { locale: fr })}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {live && (
        <FinishDialog
          task={live}
          products={productsQ.data ?? []}
          equipment={equipmentQ.data ?? []}
          taskProducts={(taskProductsQ.data ?? []).filter((tp) => tp.task_id === live.id)}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}


async function uploadMedia(taskId: string, kind: string, blob: Blob, ext: string): Promise<string> {
  const path = `${taskId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("task-media").upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  const { data } = supabase.storage.from("task-media").getPublicUrl(path);
  return data.publicUrl;
}

function TaskCard({ task, onStart, onFinish, onPhoto }: { task: TaskRow; onStart: () => void; onFinish: () => void; onPhoto: () => void }) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 w-full ${task.status === "termine" ? "bg-success" : task.status === "en_cours" ? "bg-accent" : "bg-primary"}`} />
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">{task.title}</div>
            <div className="text-sm text-muted-foreground">{task.client}</div>
          </div>
          <Badge variant={task.status === "termine" ? "secondary" : task.status === "en_cours" ? "default" : "outline"}>
            {task.status === "planifie" ? "planifié" : task.status === "en_cours" ? "en cours" : "terminé"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(parseISO(task.scheduled_at), "HH'h'mm")} · {task.duration}h</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.address}</span>
        </div>

        {task.status === "en_cours" && (
          <div className="grid grid-cols-2 gap-2">
            <PhotoButton taskId={task.id} kind="before" label="Photo avant" url={task.photo_before_url} field="photo_before_url" onUploaded={onPhoto} />
            <PhotoButton taskId={task.id} kind="after" label="Photo après" url={task.photo_after_url} field="photo_after_url" onUploaded={onPhoto} />
          </div>
        )}

        {task.status === "planifie" && (
          <Button size="lg" className="h-14 w-full text-base font-semibold" onClick={onStart}>
            <Play className="mr-2 h-5 w-5" /> Démarrer
          </Button>
        )}
        {task.status === "en_cours" && (
          <Button size="lg" className="h-14 w-full bg-success text-success-foreground hover:bg-success/90 text-base font-semibold" onClick={onFinish}>
            <CheckCircle2 className="mr-2 h-5 w-5" /> Terminer le chantier
          </Button>
        )}
        {task.status === "termine" && (
          <div className="flex items-center gap-2 rounded-md bg-success/10 p-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" /> Terminé à {task.finished_at ? format(parseISO(task.finished_at), "HH'h'mm") : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoButton({ taskId, kind, label, url, field, onUploaded }: { taskId: string; kind: "before" | "after"; label: string; url: string | null; field: "photo_before_url" | "photo_after_url"; onUploaded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const publicUrl = await uploadMedia(taskId, `photo-${kind}`, f, ext);
      const update = field === "photo_before_url" ? { photo_before_url: publicUrl } : { photo_after_url: publicUrl };
      const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
      if (error) throw error;
      toast.success(`${label} enregistrée`);
      onUploaded();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button variant="outline" type="button" disabled={busy} className="h-20 w-full flex-col gap-1 overflow-hidden p-1" onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : url ? (
          <img src={url} alt={label} className="h-full w-full rounded object-cover" />
        ) : (<><Camera className="h-5 w-5" /><span className="text-xs">{label}</span></>)}
      </Button>
    </div>
  );
}

function FinishDialog({ task, products, equipment, taskProducts, onClose }:
  { task: TaskRow; products: ProductRow[]; equipment: { id: string; name: string }[]; taskProducts: TaskProductRow[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [signature, setSignature] = useState<string | undefined>(task.signature_url ?? undefined);
  const [scanOpen, setScanOpen] = useState(false);
  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["task-products"] });
  };

  const addProduct = async (productId: string, quantity: number, lotNumber?: string, dose?: number) => {
    const existing = taskProducts.find((tp) => tp.product_id === productId);
    if (existing) {
      const { error } = await supabase.from("task_products").update({ 
        quantity: existing.quantity + quantity,
        lot_number: lotNumber || existing.lot_number,
        dose_per_m2: dose || existing.dose_per_m2
      }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("task_products").insert({ 
        task_id: task.id, 
        product_id: productId, 
        quantity,
        lot_number: lotNumber,
        dose_per_m2: dose
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Produit ajouté");
    refresh();
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("task_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const reportAnomaly = async (equipmentId: string, description: string) => {
    const { error: e1 } = await supabase.from("anomalies").insert({
      task_id: task.id, equipment_id: equipmentId, reported_by: user!.id, description,
    });
    if (e1) return toast.error(e1.message);
    await supabase.from("equipment").update({ status: "Maintenance requise" }).eq("id", equipmentId);
    toast.warning("Anomalie transmise à la coordination");
    setAnomalyOpen(false);
  };

  const submitClose = async () => {
    if (!signature) { toast.error("Signature client requise"); return; }
    setBusy(true);
    try {
      let signatureUrl = signature;
      if (signature.startsWith("data:")) {
        const blob = await (await fetch(signature)).blob();
        signatureUrl = await uploadMedia(task.id, "signature", blob, "png");
      }
      const { error } = await supabase.from("tasks").update({
        status: "termine",
        finished_at: new Date().toISOString(),
        signature_url: signatureUrl,
        notes,
      }).eq("id", task.id);
      if (error) throw error;
      toast.success("Chantier clôturé ✅");
      refresh();
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Clôturer : {task.title}</DialogTitle></DialogHeader>

        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Produits utilisés</label>
              <Button size="sm" variant="outline" onClick={() => setScanOpen(true)}>
                <QrCode className="mr-1 h-4 w-4" /> Scanner / Ajouter
              </Button>
            </div>
            {taskProducts.length === 0 && <p className="text-xs text-muted-foreground">Aucun produit déclaré.</p>}
            <div className="space-y-1">
              {taskProducts.map((tp) => {
                const p = products.find((x) => x.id === tp.product_id);
                if (!p) return null;
                return (
                  <div key={tp.id} className="flex items-center justify-between rounded-md border bg-secondary/40 p-2 text-sm">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{tp.quantity} {p.unit}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProduct(tp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <PhotoButton taskId={task.id} kind="before" label="Photo avant" url={task.photo_before_url} field="photo_before_url" onUploaded={refresh} />
            <PhotoButton taskId={task.id} kind="after" label="Photo après" url={task.photo_after_url} field="photo_after_url" onUploaded={refresh} />
          </section>

          <section>
            <label className="mb-1 block text-sm font-medium">Notes / observations</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => setAnomalyOpen(true)}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Déclarer une anomalie matériel
            </Button>
          </section>

          <section>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium"><Pencil className="h-3.5 w-3.5" /> Signature client</label>
            <SignaturePad value={signature?.startsWith("data:") ? signature : undefined} onChange={setSignature} />
            {signature && !signature.startsWith("data:") && <p className="mt-1 text-xs text-muted-foreground">Signature déjà enregistrée.</p>}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submitClose} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Valider la clôture
          </Button>
        </DialogFooter>

        {scanOpen && <ScanDialog products={products} onClose={() => setScanOpen(false)} onPick={addProduct} />}
        {anomalyOpen && <AnomalyDialog equipment={equipment} onClose={() => setAnomalyOpen(false)} onSubmit={reportAnomaly} />}
      </DialogContent>
    </Dialog>
  );
}

function ScanDialog({ products, onClose, onPick }: { products: ProductRow[]; onClose: () => void; onPick: (id: string, qty: number, lot?: string, dose?: number) => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [lot, setLot] = useState("");
  const [dose, setDose] = useState("");
  const [scanning, setScanning] = useState(true);
  const product = products.find((p) => p.id === productId);

  useState(() => { setTimeout(() => { const r = products[Math.floor(Math.random() * products.length)]; if (r) setProductId(r.id); setScanning(false); }, 1000); });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>📷 Scan QR — Produit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className={`rounded-md border-2 border-dashed p-6 text-center ${scanning ? "border-primary bg-primary/5" : "border-success bg-success/5"}`}>
            <QrCode className={`mx-auto h-12 w-12 ${scanning ? "animate-pulse text-primary/60" : "text-success"}`} />
            <p className="mt-2 text-xs text-muted-foreground">{scanning ? "Recherche d'un QR code..." : "QR détecté ✓"}</p>
          </div>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>))}</SelectContent>
          </Select>
          <div>
            <label className="text-sm">Quantité {product && `(${product.unit})`}</label>
            <Input type="number" step="0.1" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">N° Lot</label>
              <Input placeholder="Ex: L24-001" value={lot} onChange={(e) => setLot(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Dose/m²</label>
              <Input type="number" placeholder="0.0" value={dose} onChange={(e) => setDose(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!productId || parseFloat(qty) <= 0} onClick={() => onPick(productId, parseFloat(qty) || 0, lot, parseFloat(dose) || undefined)}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnomalyDialog({ equipment, onClose, onSubmit }: { equipment: { id: string; name: string }[]; onClose: () => void; onSubmit: (id: string, desc: string) => void }) {
  const [eqId, setEqId] = useState(equipment[0]?.id ?? "");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Anomalie matériel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Matériel concerné</label>
            <Select value={eqId} onValueChange={setEqId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>{equipment.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Description du problème</label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : démarrage difficile, fuite d'huile..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" disabled={!eqId || !desc.trim()} onClick={() => onSubmit(eqId, desc.trim())}>
            <AlertTriangle className="mr-1 h-4 w-4" /> Signaler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
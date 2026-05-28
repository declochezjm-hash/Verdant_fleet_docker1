import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { type Task, type ProductUsage } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Play, CheckCircle2, MapPin, Clock, Camera, QrCode, AlertTriangle, Pencil, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/signature-pad";
import { startOfDay, endOfDay } from "date-fns";

export function AgentView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Récupération du profil
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    }
  });

  // Récupération des tâches du jour assignées
  const { data: myTasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "agent", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_assignments!inner(user_id)
        `)
        .eq("task_assignments.user_id", user!.id)
        .gte("scheduled_at", startOfDay(new Date()).toISOString())
        .lte("scheduled_at", endOfDay(new Date()).toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data.map(t => ({
        ...t,
        date: t.scheduled_at,
        startedAt: t.started_at,
        finishedAt: t.finished_at,
        photos: { before: t.photo_before_url, after: t.photo_after_url },
        assignedAgents: t.task_assignments.map((a: any) => a.user_id)
      })) as unknown as Task[];
    }
  });

  const startTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "en_cours", started_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Chantier démarré");
    }
  });

  const [openTask, setOpenTask] = useState<Task | null>(null);
  const liveTask = openTask; 

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
        <h1 className="text-2xl font-bold">Bonjour {profile?.name?.split(" ")[0] || "Agent"}</h1>
        <p className="text-sm text-muted-foreground">{myTasks.length} chantier{myTasks.length > 1 ? "s" : ""} aujourd'hui</p>
      </div>

      <div className="space-y-3">
        {myTasks.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucun chantier prévu aujourd'hui 🌿</CardContent></Card>
        )}
        {myTasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onFinish={() => setOpenTask(task)} 
            onStart={() => startTaskMutation.mutate(task.id)} 
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
                <div className="text-xs text-muted-foreground">{format(parseISO(t.date), "EEE d MMM HH'h'", { locale: fr })}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {liveTask && <FinishTaskDialog task={liveTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function TaskCard({ task, onFinish, onStart }: { task: Task; onFinish: () => void; onStart: () => void }) {
  const setTaskPhoto = useStore((s) => s.setTaskPhoto);
  return (
    <Card className="overflow-hidden">
      <div className={`h-1.5 w-full ${task.status === "terminé" ? "bg-success" : task.status === "en cours" ? "bg-accent" : "bg-primary"}`} />
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">{task.title}</div>
            <div className="text-sm text-muted-foreground">{task.client}</div>
          </div>
          <Badge variant={task.status === "terminé" ? "secondary" : task.status === "en cours" ? "default" : "outline"}>
            {task.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(parseISO(task.date), "HH'h'mm")} · {task.duration}h</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.address}</span>
        </div>

        {task.status === "en cours" && (
          <div className="grid grid-cols-2 gap-2">
            <PhotoButton label="Photo avant" value={task.photos.before} onChange={(d) => setTaskPhoto(task.id, "before", d)} />
            <PhotoButton label="Photo après" value={task.photos.after} onChange={(d) => setTaskPhoto(task.id, "after", d)} />
          </div>
        )}

        {task.status === "planifié" && (
          <Button size="lg" className="h-14 w-full text-base font-semibold" onClick={onStart}>
            <Play className="mr-2 h-5 w-5" /> Démarrer
          </Button>
        )}
        {task.status === "en cours" && (
          <Button size="lg" className="h-14 w-full bg-success text-success-foreground hover:bg-success/90 text-base font-semibold" onClick={onFinish}>
            <CheckCircle2 className="mr-2 h-5 w-5" /> Terminer le chantier
          </Button>
        )}
        {task.status === "terminé" && (
          <div className="flex items-center gap-2 rounded-md bg-success/10 p-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" /> Terminé à {task.finishedAt ? format(parseISO(task.finishedAt), "HH'h'mm") : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoButton({ label, value, onChange }: { label: string; value?: string; onChange: (d: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const onFile = (f?: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { onChange(reader.result as string); toast.success(`${label} enregistrée`); };
    reader.readAsDataURL(f);
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button variant="outline" type="button" className="h-20 w-full flex-col gap-1 overflow-hidden p-1" onClick={() => ref.current?.click()}>
        {value ? (
          <img src={value} alt={label} className="h-full w-full rounded object-cover" />
        ) : (
          <>
            <Camera className="h-5 w-5" />
            <span className="text-xs">{label}</span>
          </>
        )}
      </Button>
    </div>
  );
}

function FinishTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { products, equipment, finishTask, addProductUsage, removeProductUsage, setTaskPhoto, reportAnomaly } = useStore();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [signature, setSignature] = useState<string | undefined>(task.signature);
  const [scanOpen, setScanOpen] = useState(false);
  const [anomalyOpen, setAnomalyOpen] = useState(false);

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
            {task.productsUsed.length === 0 && <p className="text-xs text-muted-foreground">Aucun produit déclaré.</p>}
            <div className="space-y-1">
              {task.productsUsed.map((u) => {
                const p = products.find((x) => x.id === u.productId);
                if (!p) return null;
                return (
                  <div key={u.productId} className="flex items-center justify-between rounded-md border bg-secondary/40 p-2 text-sm">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{u.quantity} {p.unit}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProductUsage(task.id, u.productId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <PhotoButton label="Photo avant" value={task.photos.before} onChange={(d) => setTaskPhoto(task.id, "before", d)} />
            <PhotoButton label="Photo après" value={task.photos.after} onChange={(d) => setTaskPhoto(task.id, "after", d)} />
          </section>

          <section>
            <label className="mb-1 block text-sm font-medium">Notes / observations</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques chantier..." rows={3} />
            <Button variant="ghost" size="sm" className="mt-1 text-destructive" onClick={() => setAnomalyOpen(true)}>
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Déclarer une anomalie matériel
            </Button>
          </section>

          <section>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium"><Pencil className="h-3.5 w-3.5" /> Signature client</label>
            <SignaturePad value={signature} onChange={setSignature} />
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => {
            if (!signature) { toast.error("Signature client requise"); return; }
            finishTask(task.id, { signature, notes });
            toast.success("Chantier clôturé ✅");
            onClose();
          }}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Valider la clôture
          </Button>
        </DialogFooter>

        {scanOpen && <ScanDialog onClose={() => setScanOpen(false)} onPick={(productId, qty) => { addProductUsage(task.id, { productId, quantity: qty }); toast.success("Produit ajouté"); setScanOpen(false); }} />}
        {anomalyOpen && (
          <AnomalyDialog
            equipmentOptions={equipment.filter((e) => task.equipmentIds.includes(e.id))}
            onClose={() => setAnomalyOpen(false)}
            onSubmit={(eqId, desc) => { reportAnomaly(task.id, eqId, desc); toast.warning("Anomalie transmise à la coordination"); setAnomalyOpen(false); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScanDialog({ onClose, onPick }: { onClose: () => void; onPick: (id: string, qty: number) => void }) {
  const products = useStore((s) => s.products);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [scanning, setScanning] = useState(true);
  const product = products.find((p) => p.id === productId);

  // Simulation : après 1.2s, "détecte" un QR aléatoire
  useEffect(() => {
    const id = setTimeout(() => {
      const random = products[Math.floor(Math.random() * products.length)];
      if (random) setProductId(random.id);
      setScanning(false);
    }, 1200);
    return () => clearTimeout(id);
  }, [products]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>📷 Scan QR — Produit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className={`relative rounded-md border-2 border-dashed p-6 text-center transition-colors ${scanning ? "border-primary bg-primary/5" : "border-success bg-success/5"}`}>
            <QrCode className={`mx-auto h-12 w-12 ${scanning ? "animate-pulse text-primary/60" : "text-success"}`} />
            <p className="mt-2 text-xs text-muted-foreground">{scanning ? "Recherche d'un QR code..." : "QR détecté ✓"}</p>
          </div>
          <div>
            <label className="text-sm">Produit détecté</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">Quantité {product && `(${product.unit})`}</label>
            <Input type="number" step="0.1" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="mr-1 h-4 w-4" />Annuler</Button>
          <Button disabled={!productId || parseFloat(qty) <= 0} onClick={() => onPick(productId, parseFloat(qty) || 0)}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnomalyDialog({ equipmentOptions, onClose, onSubmit }: { equipmentOptions: { id: string; name: string }[]; onClose: () => void; onSubmit: (eqId: string, desc: string) => void }) {
  const [eqId, setEqId] = useState(equipmentOptions[0]?.id ?? "");
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
              <SelectContent>
                {equipmentOptions.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun matériel sur ce chantier</div>}
                {equipmentOptions.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
              </SelectContent>
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

import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Play, CheckCircle2, MapPin, Clock, Camera, QrCode, AlertTriangle, Pencil, Plus, Trash2, Loader2, X, Maximize2, RotateCw, Save, Circle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/signature-pad";

interface ProductRow { id: string; name: string; category: string; unit: string; stock: number }
interface TaskRow {
  id: string; title: string; client: string; address: string;
  scheduled_at: string; duration: number; status: "planifie" | "en_cours" | "termine";
  started_at: string | null; finished_at: string | null;
  signature_url: string | null; photo_before_url: string | null; photo_after_url: string | null;
  notes: string | null;
}
interface TaskProductRow { id: string; task_id: string; product_id: string; quantity: number; lot_number?: string; dose_per_m2?: number }

export function AgentSupabaseView() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const tasksQ = useQuery({
    queryKey: ["my-tasks", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes : les tâches ne changent pas toutes les secondes
    gcTime: 1000 * 60 * 30,  // Garder en cache 30 minutes
    refetchOnWindowFocus: true, // Important pour l'agent qui change d'app
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
      const { data, error } = await supabase.from("products").select("id,name,category,unit,stock").order("name");
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
    queryKey: ["task-products", tasksQ.data?.map(t => t.id)],
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
    () => !mounted ? [] : (tasksQ.data ?? []).filter((t) => isToday(parseISO(t.scheduled_at))),
    [tasksQ.data, mounted]
  );
  const upcoming = useMemo(
    () => !mounted ? [] : (tasksQ.data ?? []).filter((t) => new Date(t.scheduled_at) > new Date() && !isToday(parseISO(t.scheduled_at))).slice(0, 3),
    [tasksQ.data, mounted]
  );

  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const handlePreview = (url: string) => { setRotation(0); setPreviewUrl(url); };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [anomalyTaskId, setAnomalyTaskId] = useState<string | null>(null);

  const handleQuickAnomaly = async (equipmentId: string, description: string) => {
    if (!anomalyTaskId || !user) return;
    try {
      const { error: e1 } = await supabase.from("anomalies").insert({
        task_id: anomalyTaskId, 
        equipment_id: equipmentId, 
        reported_by: user.id, 
        description,
      });
      if (e1) throw e1;
      await supabase.from("equipment").update({ status: "Maintenance requise" }).eq("id", equipmentId);
      toast.warning("Anomalie matériel transmise à la coordination");
      setAnomalyTaskId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const live = openTask ? (tasksQ.data ?? []).find((t) => t.id === openTask.id) ?? null : null;

  if (tasksQ.isLoading) return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <p className="text-sm text-muted-foreground">
          {mounted ? format(new Date(), "EEEE d MMMM", { locale: fr }) : "..."}
        </p>
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
            onAnomaly={() => setAnomalyTaskId(task.id)}
            onPhoto={() => qc.invalidateQueries({ queryKey: ["my-tasks"] })}
            onPreview={handlePreview}
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
          onPreview={handlePreview}
        />
      )}

      {anomalyTaskId && (
        <AnomalyDialog
          equipment={equipmentQ.data ?? []}
          onClose={() => setAnomalyTaskId(null)}
          onSubmit={handleQuickAnomaly}
        />
      )}

      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setRotation(0); }}>
          <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none sm:max-w-[80vw]">
            <div className="relative flex flex-col items-center justify-center h-full max-h-[90vh]">
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-300"
                  style={{ transform: `rotate(${rotation}deg)` }} 
                />
              </div>
              
              <div className="absolute -top-12 right-0 flex gap-2">
                <Button 
                  className="rounded-full bg-black/50 hover:bg-black/70 text-white" 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                >
                  <RotateCw className="h-6 w-6" />
                </Button>
                <Button 
                  className="rounded-full bg-black/50 hover:bg-black/70 text-white" 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setPreviewUrl(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

/**
 * Compresse une image côté client avant l'upload
 */
async function compressImage(file: File | Blob, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Compression failed")),
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

/**
 * Éditeur d'annotations simple sur canevas
 */
function AnnotationDialog({ file, onSave, onCancel }: { file: File; onSave: (blob: Blob) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'circle' | 'arrow'>('pen');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      // Ajuster la taille du canevas en gardant le ratio (max 1200px)
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w *= ratio;
        h *= ratio;
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      
      // Style du trait d'annotation (Rouge vif pour la visibilité)
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
  }, [file]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    // Calculer les coordonnées relatives au canevas
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headlen = 20;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawCircle = (ctx: CanvasRenderingContext2D, sX: number, sY: number, eX: number, eY: number) => {
    const radius = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eY - sY, 2));
    ctx.beginPath();
    ctx.arc(sX, sY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoords(e);
    setStartPos({ x, y });
    
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !snapshotRef.current) return;

    const { x, y } = getCoords(e);

    if (tool === 'pen') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Effacer et redessiner la forme pour l'aperçu dynamique
      ctx.putImageData(snapshotRef.current, 0, 0);
      if (tool === 'circle') drawCircle(ctx, startPos.x, startPos.y, x, y);
      else if (tool === 'arrow') drawArrow(ctx, startPos.x, startPos.y, x, y);
    }
  };

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.8);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[800px] p-0 overflow-hidden bg-zinc-950 border-zinc-800">
        <div className="flex flex-col h-[85vh]">
          <div className="p-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-white text-sm font-medium hidden xs:flex items-center gap-2 mr-2">
                <Pencil className="h-4 w-4 text-primary" /> Annoter
              </DialogTitle>
              <div className="flex bg-zinc-800 rounded-md p-1 border border-zinc-700">
                <Button 
                  size="sm" 
                  variant={tool === 'pen' ? 'default' : 'ghost'} 
                  className={`h-8 w-8 p-0 ${tool === 'pen' ? 'bg-primary text-primary-foreground' : 'text-zinc-400'}`}
                  onClick={() => setTool('pen')}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant={tool === 'circle' ? 'default' : 'ghost'} 
                  className={`h-8 w-8 p-0 ${tool === 'circle' ? 'bg-primary text-primary-foreground' : 'text-zinc-400'}`}
                  onClick={() => setTool('circle')}
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant={tool === 'arrow' ? 'default' : 'ghost'} 
                  className={`h-8 w-8 p-0 ${tool === 'arrow' ? 'bg-primary text-primary-foreground' : 'text-zinc-400'}`}
                  onClick={() => setTool('arrow')}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel} className="text-zinc-400">Annuler</Button>
              <Button size="sm" onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black/40">
            <canvas
              ref={canvasRef}
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={() => setIsDrawing(false)}
              className="max-w-full max-h-full rounded shadow-xl bg-white touch-none cursor-crosshair"
            />
          </div>
          <div className="p-3 text-center text-[10px] text-zinc-500 bg-zinc-900 border-t border-zinc-800 uppercase tracking-widest">
            Touchez l'écran pour dessiner en rouge
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task, onStart, onFinish, onPhoto, onPreview, onAnomaly }: { task: TaskRow; onStart: () => void; onFinish: () => void; onPhoto: () => void; onPreview: (url: string) => void; onAnomaly: () => void }) {
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
            <PhotoButton taskId={task.id} kind="before" label="Photo avant" url={task.photo_before_url} field="photo_before_url" onUploaded={onPhoto} onPreview={onPreview} />
            <PhotoButton taskId={task.id} kind="after" label="Photo après" url={task.photo_after_url} field="photo_after_url" onUploaded={onPhoto} onPreview={onPreview} />
          </div>
        )}

        {task.status === "planifie" && (
          <Button size="lg" className="h-14 w-full text-base font-semibold" onClick={onStart}>
            <Play className="mr-2 h-5 w-5" /> Démarrer
          </Button>
        )}
        {task.status === "en_cours" && (
          <div className="flex gap-2">
            <Button size="lg" className="h-14 flex-1 bg-success text-success-foreground hover:bg-success/90 text-base font-semibold" onClick={onFinish}>
              <CheckCircle2 className="mr-2 h-5 w-5" /> Terminer
            </Button>
            <Button size="lg" variant="outline" className="h-14 w-14 p-0 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={onAnomaly}>
              <AlertTriangle className="h-6 w-6" />
            </Button>
          </div>
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

function PhotoButton({ taskId, kind, label, url, field, onUploaded, onPreview }: { taskId: string; kind: "before" | "after"; label: string; url: string | null; field: "photo_before_url" | "photo_after_url"; onUploaded: () => void; onPreview: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleAnnotated = async (annotatedBlob: Blob) => {
    setPendingFile(null);
    setBusy(true);
    try {
      // Compression finale avant upload
      const compressedBlob = await compressImage(annotatedBlob);
      const publicUrl = await uploadMedia(taskId, `photo-${kind}`, compressedBlob, "jpg");
      
      const update = field === "photo_before_url" ? { photo_before_url: publicUrl } : { photo_after_url: publicUrl };
      const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
      if (error) throw error;
      toast.success(`${label} enregistrée`);
      onUploaded();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative">
      <input 
        ref={ref} 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={(e) => setPendingFile(e.target.files?.[0] || null)} 
      />

      {pendingFile && (
        <AnnotationDialog 
          file={pendingFile} 
          onSave={handleAnnotated} 
          onCancel={() => setPendingFile(null)} 
        />
      )}

      {url ? (
        <div className="relative h-20 w-full overflow-hidden rounded-md border bg-muted">
          <img 
            src={url} 
            alt={label} 
            className="h-full w-full cursor-zoom-in object-cover transition-opacity hover:opacity-90" 
            onClick={() => onPreview(url)}
          />
          <Button 
            variant="secondary" 
            size="icon" 
            disabled={busy}
            className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={() => ref.current?.click()}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </Button>
          <div className="absolute left-1 top-1 rounded bg-black/40 px-1 text-[9px] uppercase text-white font-bold tracking-wider">
            {label}
          </div>
        </div>
      ) : (
        <Button variant="outline" type="button" disabled={busy} className="h-20 w-full flex-col gap-1 p-1" onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <><Camera className="h-5 w-5" /><span className="text-xs">{label}</span></>
          )}
        </Button>
      )}
    </div>
  );
}

function FinishDialog({ task, products, equipment, taskProducts, onClose, onPreview }:
  { task: TaskRow; products: ProductRow[]; equipment: { id: string; name: string }[]; taskProducts: TaskProductRow[]; onClose: () => void; onPreview: (url: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [signature, setSignature] = useState<string | undefined>(task.signature_url ?? undefined);
  const [localProducts, setLocalProducts] = useState<{
    product_id: string; 
    quantity: number;
    lot_number?: string;
    dose_per_m2?: number;
  }[]>(
    taskProducts.map(tp => ({ product_id: tp.product_id, quantity: tp.quantity, lot_number: tp.lot_number, dose_per_m2: tp.dose_per_m2 }))
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [anomalyOpen, setAnomalyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["task-products"] });
  };

  const addProduct = (productId: string, quantity: number, lot_number?: string, dose_per_m2?: number) => {
    setLocalProducts(prev => {
      const existing = prev.find(p => p.product_id === productId);
      if (existing) {
        return prev.map(p => p.product_id === productId ? { ...p, quantity: p.quantity + quantity, lot_number, dose_per_m2 } : p);
      }
      return [...prev, { product_id: productId, quantity, lot_number, dose_per_m2 }];
    });
    toast.success("Produit ajouté à la liste");
  };

  const removeProduct = (productId: string) => {
    setLocalProducts(prev => prev.filter(p => p.product_id !== productId));
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

      // Préparation propre des produits pour le JSONB PostgreSQL
      const productsPayload = localProducts.map(p => ({
        productId: p.product_id,
        quantity: p.quantity,
        lot: p.lot_number,
        dose: p.dose_per_m2
      }));

      // Appel de la fonction RPC pour une clôture atomique (status + stocks + labor_cost)
      const { error } = await supabase.rpc("finish_task", {
        p_task_id: task.id,
        p_notes: notes,
        p_signature_url: signatureUrl,
        p_products: productsPayload
      });

      if (error) throw new Error(error.message);

      toast.success("Chantier clôturé ✅");
      refresh();
      onClose();
    } catch (e) { 
      console.error("RPC finish_task error:", e);
      toast.error(`Échec de la clôture : ${(e as Error).message}`); 
    }
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
            {localProducts.length === 0 && <p className="text-xs text-muted-foreground">Aucun produit déclaré.</p>}
            <div className="space-y-1">
              {localProducts.map((lp) => {
                const p = products.find((x) => x.id === lp.product_id);
                if (!p) return null;
                return (
                  <div key={lp.product_id} className="rounded-md border bg-secondary/40 p-2 text-sm">
                    <div className="flex items-center justify-between font-medium">
                      <span>{p.name}</span>
                      <Badge variant="outline">{lp.quantity} {p.unit}</Badge>
                    </div>
                    {(lp.lot_number || lp.dose_per_m2) && (
                      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground uppercase">
                        {lp.lot_number && <span>Lot: {lp.lot_number}</span>}
                        {lp.dose_per_m2 && <span>Dose: {lp.dose_per_m2} /m²</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProduct(lp.product_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <PhotoButton taskId={task.id} kind="before" label="Photo avant" url={task.photo_before_url} field="photo_before_url" onUploaded={refresh} onPreview={onPreview} />
            <PhotoButton taskId={task.id} kind="after" label="Photo après" url={task.photo_after_url} field="photo_after_url" onUploaded={refresh} onPreview={onPreview} />
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const r = products[Math.floor(Math.random() * products.length)];
      if (r) setProductId(r.id);
      setScanning(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [products]);

  const selectedQty = parseFloat(qty) || 0;
  const isStockInsufficient = product ? selectedQty > product.stock : false;

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
            <div className="flex items-center justify-between">
              <label className="text-sm">Quantité {product && `(${product.unit})`}</label>
              {product && (
                <span className={`text-xs font-medium ${isStockInsufficient ? "text-destructive" : "text-muted-foreground"}`}>
                  Disponible: {product.stock} {product.unit}
                </span>
              )}
            </div>
            <Input 
              type="number" 
              step="0.1" 
              min="0" 
              value={qty} 
              onChange={(e) => setQty(e.target.value)}
              className={isStockInsufficient ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {isStockInsufficient && (
              <p className="mt-1 text-[10px] text-destructive font-medium">Quantité supérieure au stock disponible.</p>
            )}
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
          <Button disabled={!productId || selectedQty <= 0 || isStockInsufficient} onClick={() => onPick(productId, selectedQty, lot, parseFloat(dose) || undefined)}>
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

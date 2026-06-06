import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, Clock, Wrench, User, Filter, Camera, Image as ImageIcon, X, RotateCw, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { compressImage } from "@/lib/image-utils";

interface AnomalyWithJoins {
  id: string;
  description: string;
  resolved: boolean;
  created_at: string;
  priority: string;
  photo_url: string | null;
  repair_photo_url: string | null;
  repair_notes: string | null;
  equipment: { id: string; name: string; type: string; internal_id: string | null } | null;
  tasks: { id: string; title: string; client: string } | null;
  profiles: { id: string; name: string } | null;
}

export function AnomaliesView() {
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: anomalies, isLoading, error } = useQuery({
    queryKey: ["all-anomalies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anomalies")
        .select(`
          *,
          equipment:equipment_id(id, name, type, internal_id),
          tasks:task_id(id, title, client),
          profiles:reported_by(id, name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as AnomalyWithJoins[];
    },
  });

  // Afficher l'erreur en cas d'échec de la requête
  useEffect(() => {
    if (error) toast.error("Erreur de chargement : " + (error as Error).message);
  }, [error]);

  const resolveMut = useMutation({
    mutationFn: async ({ anomaly, repairPhotoUrl, repairNotes }: { anomaly: AnomalyWithJoins, repairPhotoUrl?: string, repairNotes?: string }) => {
      // 1. Marquer l'anomalie comme résolue
      const { error: e1 } = await supabase
        .from("anomalies")
        .update({ 
          resolved: true,
          repair_notes: repairNotes || null,
          repair_photo_url: repairPhotoUrl || anomaly.repair_photo_url 
        })
        .eq("id", anomaly.id);
      if (e1) throw e1;

      // 2. Si un équipement est lié, le remettre en status 'OK'
      if (anomaly.equipment?.id) {
        const { error: e2 } = await supabase
          .from("equipment")
          .update({ status: "OK" })
          .eq("id", anomaly.equipment.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-anomalies"] });
      qc.invalidateQueries({ queryKey: ["unresolved-anomalies-count"] });
      qc.invalidateQueries({ queryKey: ["equipment-alerts-count"] });
      qc.invalidateQueries({ queryKey: ["equip-min"] }); // Invalider le cache du matériel pour le planning
      toast.success("Anomalie résolue et matériel remis en service");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // On calcule tout avant le moindre 'return' conditionnel
  const { openAnomalies, resolvedAnomalies, filteredCount } = useMemo(() => {
    const filtered = anomalies?.filter(a => {
      const matchesPriority = priorityFilter === "all" || 
        (a.priority?.toLowerCase() === priorityFilter.toLowerCase());
      
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        (a.equipment?.name?.toLowerCase().includes(term)) || 
        (a.equipment?.internal_id?.toLowerCase().includes(term));

      return matchesPriority && matchesSearch;
    }) ?? [];
    
    return {
      openAnomalies: filtered.filter(a => !a.resolved),
      resolvedAnomalies: filtered.filter(a => a.resolved),
      filteredCount: filtered.length
    };
  }, [anomalies, priorityFilter]);

  if (isLoading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal des Anomalies</h1>
          <p className="text-sm text-muted-foreground">Suivi des pannes signalées par les agents terrain.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un engin (Nom, N°)..." 
              className="pl-9 h-10 sm:h-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Pannes à traiter ({openAnomalies.length})
        </h2>
        {openAnomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucune panne en attente. Tout est opérationnel ! 🌿</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openAnomalies.map((a) => ( // Pass repairNotes to AnomalyCard
              <AnomalyCard key={a.id} anomaly={a} onResolve={(photo) => resolveMut.mutate({ anomaly: a, repairPhotoUrl: photo })} isPending={resolveMut.isPending} onPreview={setPreviewUrl} />
            ))}
          </div>
        )}
      </section>

      {resolvedAnomalies.length > 0 && (
        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold text-muted-foreground">Historique des résolutions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-80 grayscale-[50%]">
            {resolvedAnomalies.map((a) => (
              <AnomalyCard key={a.id} anomaly={a} onPreview={setPreviewUrl} /> // Display repairNotes for resolved anomalies
            ))}
          </div>
        </section>
      )}

      {/* Modal de prévisualisation plein écran */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none sm:max-w-[80vw]">
          <div className="relative flex items-center justify-center">
            {previewUrl && <img src={previewUrl} className="max-h-[90vh] rounded-lg object-contain" alt="Agrandissement" />}
            <Button variant="ghost" size="icon" className="absolute -top-12 right-0 text-white" onClick={() => setPreviewUrl(null)}>
              <X className="h-8 w-8" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnomalyCard({ anomaly: a, onResolve, isPending, onPreview }: { anomaly: AnomalyWithJoins; onResolve?: (repairPhotoUrl?: string, repairNotes?: string) => void; isPending?: boolean; onPreview: (url: string) => void }) {
  const [repairPhoto, setRepairPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [repairNotes, setRepairNotes] = useState(a.repair_notes || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file);
      const filePath = `${a.id}/repair-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-media')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('task-media').getPublicUrl(filePath);
      setRepairPhoto(data.publicUrl);
      toast.success("Photo de réparation chargée");
    } catch (error: any) {
      toast.error("Erreur upload: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className={`relative overflow-hidden ${!a.resolved ? "border-destructive/30 shadow-md" : "bg-muted/30 border-muted"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={a.resolved ? "secondary" : "destructive"} className="uppercase text-[10px]">
            {a.resolved ? "Réparé" : "En attente"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(a.created_at), "d MMM yyyy HH'h'mm", { locale: fr })}
          </span>
        </div>
        <CardTitle className="text-sm font-bold mt-2">
          {a.equipment?.internal_id && <span className="text-primary mr-1.5">{a.equipment.internal_id}</span>}
          {a.equipment?.name ?? "Matériel inconnu"}
        </CardTitle>
        <p className="text-[10px] text-muted-foreground font-medium">{a.equipment?.type}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Galerie avant / après */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Signalement</span>
            {a.photo_url ? (
              <div className="aspect-square rounded-md border overflow-hidden bg-muted cursor-zoom-in" onClick={() => onPreview(a.photo_url!)}>
                <img src={a.photo_url} className="h-full w-full object-cover" alt="Panne" />
              </div>
            ) : (
              <div className="aspect-square rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-muted-foreground">Réparation</span>
            {a.repair_photo_url || repairPhoto ? (
              <div className="aspect-square rounded-md border overflow-hidden bg-muted cursor-zoom-in" onClick={() => onPreview((a.repair_photo_url || repairPhoto)!)}>
                <img src={a.repair_photo_url || repairPhoto || ''} className="h-full w-full object-cover" alt="Réparation" />
              </div>
            ) : !a.resolved ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full rounded-md border border-dashed flex flex-col items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <span className="text-[8px] mt-1 font-bold uppercase">Ajouter</span>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
              </button>
            ) : (
              <div className="aspect-square rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-md p-2 text-xs ${!a.resolved ? "bg-destructive/5 text-destructive-foreground border border-destructive/10" : "bg-muted text-muted-foreground"}`}>
          <span className="font-semibold block mb-1">Signalement :</span>
          "{a.description || "Pas de description fournie."}"
        </div>

        {!a.resolved && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Notes de réparation</label>
            <Textarea value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} placeholder="Détails de l'intervention, pièces changées..." rows={2} />
          </div>
        )}
        {a.resolved && a.repair_notes && (
          <div className="rounded-md p-2 text-xs bg-muted text-muted-foreground border border-muted-foreground/20"><span className="font-semibold block mb-1">Notes de réparation :</span>"{a.repair_notes}"</div>
        )}

        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Chantier : <span className="text-foreground font-medium">{a.tasks?.title ?? "Signalement direct"}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3 w-3" />
            <span>Par : <span className="text-foreground font-medium">{a.profiles?.name ?? "Inconnu"}</span></span>
          </div>
        </div>

        {onResolve && (
          <Button 
            className="w-full h-9 gap-2 mt-2 bg-success text-success-foreground hover:bg-success/90" 
            onClick={() => onResolve(repairPhoto || undefined, repairNotes.trim() !== "" ? repairNotes : undefined)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Marquer comme résolu
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
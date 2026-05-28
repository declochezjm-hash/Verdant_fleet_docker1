import { useState } from "react";
import { useStore, type Equipment } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Wrench, AlertTriangle, History, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export function MaterielView() {
  const { equipment, users, maintenance, addMaintenance } = useStore();
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Parc matériel & engins</h1>
        <p className="text-sm text-muted-foreground">Affectation, carnet de santé et maintenance préventive.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {equipment.map((e) => {
          const assignee = users.find((u) => u.id === e.assignedTo);
          const pct = Math.min(100, (e.hoursUsed / e.hoursForMaintenance) * 100);
          const danger = e.status !== "OK";
          return (
            <Card key={e.id} className={danger ? "border-destructive/40" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold leading-tight">{e.name}</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">{e.type}</Badge>
                  </div>
                  <Badge variant={danger ? "destructive" : "secondary"}>{e.status}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserIcon className="h-3.5 w-3.5" />
                  {assignee ? `Affecté à ${assignee.name}` : "Non affecté"}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>Compteur révision</span>
                    <span className="font-medium">{e.hoursUsed}h / {e.hoursForMaintenance}h</span>
                  </div>
                  <Progress value={pct} className={`h-1.5 ${pct > 95 ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : ""}`} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Dernière révision : {format(parseISO(e.lastMaintenance), "dd MMM yyyy", { locale: fr })}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(e)}>
                    <History className="mr-1 h-3.5 w-3.5" /> Carnet
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => { setSelected(e); setLogOpen(true); }}>
                    <Wrench className="mr-1 h-3.5 w-3.5" /> Réviser
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && !logOpen && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Carnet — {selected.name}</DialogTitle></DialogHeader>
            <div className="space-y-2">
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

      {selected && logOpen && (
        <NewMaintenanceDialog equipment={selected} onClose={() => { setLogOpen(false); setSelected(null); }} onSave={(log) => {
          addMaintenance({ ...log, equipmentId: selected.id });
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

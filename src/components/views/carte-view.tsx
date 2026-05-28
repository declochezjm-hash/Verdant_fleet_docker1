import { useStore } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Carte simplifiée : projection des coordonnées sur une boîte SVG.
export function CarteView() {
  const { tasks, users } = useStore();
  const active = tasks.filter((t) => t.status !== "terminé");
  if (active.length === 0) return <div className="p-6 text-sm text-muted-foreground">Aucun chantier actif.</div>;

  const lats = active.map((t) => t.lat); const lngs = active.map((t) => t.lng);
  const minLat = Math.min(...lats) - 0.01, maxLat = Math.max(...lats) + 0.01;
  const minLng = Math.min(...lngs) - 0.01, maxLng = Math.max(...lngs) + 0.01;
  const project = (lat: number, lng: number) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * 100,
    y: 100 - ((lat - minLat) / (maxLat - minLat)) * 100,
  });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Carte des chantiers</h1>
        <p className="text-sm text-muted-foreground">Vision géographique des chantiers actifs ({active.length}).</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-secondary/60 via-background to-accent/10">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--border)" strokeWidth="0.2"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
              </svg>
              {active.map((t, i) => {
                const p = project(t.lat, t.lng);
                const color = t.status === "en cours" ? "bg-accent" : "bg-primary";
                return (
                  <div key={t.id} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                    <div className={`flex flex-col items-center`}>
                      <div className="rounded-md bg-card px-2 py-0.5 text-[10px] font-medium shadow-md border whitespace-nowrap">
                        {t.title.slice(0, 18)}
                      </div>
                      <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${color} text-primary-foreground shadow-lg ring-4 ring-background`}>
                        <span className="text-[11px] font-bold">{i + 1}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Liste des chantiers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {active.map((t, i) => (
              <div key={t.id} className="flex items-start gap-2 rounded-md border bg-card p-2">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${t.status === "en cours" ? "bg-accent" : "bg-primary"}`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{t.title}</span>
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                  </div>
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate">{t.address}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(t.date), "EEE d MMM HH'h'", { locale: fr })} · {t.team}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

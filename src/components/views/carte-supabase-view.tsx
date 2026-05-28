import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, KeyRound, Search, X, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { TaskDetailsSheet } from "./task-details-sheet";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapTask {
  id: string; title: string; client: string; address: string; team: string;
  scheduled_at: string; status: "planifie" | "en_cours" | "termine";
  lat: number | null; lng: number | null;
}

const TOKEN_KEY = "mapbox_public_token";

export function CarteSupabaseView() {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [token, setToken] = useState<string>(() =>
    (typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY)) ||
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ""
  );
  const [tokenInput, setTokenInput] = useState("");
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState<string>("all");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const q = useQuery({
    queryKey: ["carte-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,client,address,team,scheduled_at,status,lat,lng")
        .neq("status", "termine")
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as MapTask[];
    },
  });

  const active = (q.data ?? []).filter((t) => t.lat != null && t.lng != null) as (MapTask & { lat: number; lng: number })[];
  const teams = Array.from(new Set(active.map((t) => t.team).filter(Boolean))).sort();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const s = norm(search.trim());
  const filtered = active.filter((t) => {
    if (team !== "all" && t.team !== team) return false;
    if (s && !(norm(t.title).includes(s) || norm(t.client).includes(s) || norm(t.address).includes(s))) return false;
    return true;
  });

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [4.85, 45.75],
        zoom: 10,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
    } catch (e) {
      console.error("Mapbox init error", e);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Update markers + fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;

    const apply = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const bounds = new mapboxgl.LngLatBounds();
      filtered.forEach((t, i) => {
        const el = document.createElement("button");
        el.type = "button";
        const color = t.status === "en_cours"
          ? "hsl(var(--accent))"
          : "hsl(var(--primary))";
        el.style.cssText = `display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;font-weight:700;font-size:12px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;`;
        el.textContent = String(i + 1);
        el.onclick = () => setOpenTaskId(t.id);
        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
          `<div style="font-family:inherit;font-size:12px"><strong>${t.title}</strong><br/>${t.client}<br/><span style="color:#666">${t.address}</span></div>`
        );
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([t.lng, t.lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([t.lng, t.lat]);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
    };

    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [filtered]);

  const saveToken = () => {
    if (!tokenInput.trim()) return;
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
  };

  if (q.isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (active.length === 0) return <div className="p-6 text-sm text-muted-foreground">Aucun chantier actif géolocalisé.</div>;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carte des chantiers</h1>
          <p className="text-sm text-muted-foreground">
            {search || team !== "all"
              ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""} sur ${active.length}`
              : `Vision géographique des chantiers actifs (${active.length}).`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="w-full sm:w-52">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Toutes les équipes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les équipes</SelectItem>
              {teams.map((tm) => (
                <SelectItem key={tm} value={tm}>{tm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (titre, client, adresse)..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Effacer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!token && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Token Mapbox requis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Collez votre token public Mapbox (commence par <code>pk.</code>). Récupérez-le sur{" "}
              <a className="underline" href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">account.mapbox.com</a>.
              Il sera mémorisé localement dans votre navigateur.
            </p>
            <div className="flex gap-2">
              <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="pk.eyJ1Ijoi..." />
              <Button onClick={saveToken}>Enregistrer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <div ref={mapContainer} className="aspect-[4/3] w-full bg-secondary/40" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Liste des chantiers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((t, i) => (
              <button key={t.id} type="button" onClick={() => setOpenTaskId(t.id)} className="flex w-full items-start gap-2 rounded-md border bg-card p-2 text-left transition-colors hover:bg-accent/30">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${t.status === "en_cours" ? "bg-accent" : "bg-primary"}`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{t.title}</span>
                    <Badge variant="outline" className="text-[10px]">{t.status === "en_cours" ? "en cours" : "planifié"}</Badge>
                  </div>
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate">{t.address}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(t.scheduled_at), "EEE d MMM HH'h'", { locale: fr })} · {t.team}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
      <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </div>
  );
}

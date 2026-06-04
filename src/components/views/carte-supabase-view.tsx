import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button"; // Keep this import
import { MapPin, Loader2, KeyRound, Search, X, Users, AlertCircle, Layers, Locate, Navigation, Clock, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDetailsSheet } from "./task-details-sheet";
import { WeatherBadge } from "../../../weather-badge";
import { getTeamColor } from "@/lib/team-utils";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapTask {
  id: string; title: string; client: string; address: string; team: string;
  project_number: string | null;
  scheduled_at: string; status: "planifie" | "en_cours" | "termine";
  lat: number | null; lng: number | null;
  requires_dry_weather: boolean;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Rayon de la terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance en km
}

const TOKEN_KEY = "mapbox_public_token";

export function CarteSupabaseView() {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState<string>("all");
  const [mapStyle, setMapStyle] = useState<"streets-v12" | "satellite-streets-v12">("streets-v12");
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const markerRootsRef = useRef<Root[]>([]);
  const [mounted, setMounted] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [travelDurations, setTravelDurations] = useState<Record<string, number>>({});
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const isExampleToken = token.includes("example_token") || token.includes("votre_token");

  useEffect(() => {
    // On récupère le token uniquement côté client pour éviter le mismatch SSR
    const local = localStorage.getItem(TOKEN_KEY);
    const env = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    const finalToken = (local || env || "").trim().replace(/["']/g, ""); // Nettoyage des guillemets éventuels
    
    console.log("Mapbox Token status:", finalToken ? "Detected" : "Missing");
    setToken(finalToken);
    
    setMounted(true);
  }, []);

  const q = useQuery({
    queryKey: ["carte-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,project_number,title,client,address,team,scheduled_at,status,lat,lng,requires_dry_weather")
        .neq("status", "termine")
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as MapTask[];
    },
  });

  // Récupération des couleurs d'équipes depuis la base de données
  const { data: teamsData = [] } = useQuery({
    queryKey: ["teams-colors"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("name, color");
      return data || [];
    }
  });

  const active = useMemo(() => 
    (q.data ?? []).filter((t) => t.lat != null && t.lng != null) as (MapTask & { lat: number; lng: number })[],
    [q.data]
  );

  const teams = useMemo(() => 
    Array.from(new Set(active.map((t) => t.team).filter(Boolean))).sort(),
    [active]
  );

  const filtered = useMemo(() => {
    const norm = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const s = norm(search.trim());
    return active.filter((t) => {
      if (team !== "all" && t.team !== team) return false;
      if (s && !(norm(t.title).includes(s) || norm(t.client).includes(s) || norm(t.address).includes(s))) return false;
      return true;
    });
  }, [active, team, search]);

  const closestTask = useMemo(() => {
    if (!userCoords || filtered.length === 0) return null;
    let minTask = filtered[0];
    let minDistance = getDistance(userCoords[1], userCoords[0], minTask.lat, minTask.lng);
    for (let i = 1; i < filtered.length; i++) {
      const d = getDistance(userCoords[1], userCoords[0], filtered[i].lat, filtered[i].lng);
      if (d < minDistance) { minDistance = d; minTask = filtered[i]; }
    }
    return { task: minTask, distance: minDistance };
  }, [userCoords, filtered]);

  // Récupération des temps de trajet pour toute la liste via Mapbox Matrix API
  useEffect(() => {
    const getTravelTimes = async () => {
      if (!userCoords || filtered.length === 0 || !token || isExampleToken) {
        setTravelDurations({});
        return;
      }

      setIsCalculatingRoute(true);
      try {
        // Mapbox Matrix supporte jusqu'à 25 points (1 source + 24 destinations)
        const targetTasks = filtered.slice(0, 24);
        const coords = [
          `${userCoords[0]},${userCoords[1]}`,
          ...targetTasks.map(t => `${t.lng},${t.lat}`)
        ].join(';');

        const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}?access_token=${token}&sources=0&annotations=duration`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.durations && data.durations[0]) {
          const newDurations: Record<string, number> = {};
          // durations[0] contient les durées depuis la source 0 vers toutes les destinations
          // l'index 0 est l'origine vers l'origine, on commence donc à 1
          targetTasks.forEach((t, i) => {
            const d = data.durations[0][i + 1];
            if (d !== null) newDurations[t.id] = d;
          });
          setTravelDurations(newDurations);
        }
      } catch (err) {
        console.error("Erreur Matrix API:", err);
      } finally {
        setIsCalculatingRoute(false);
      }
    };

    getTravelTimes();
  }, [userCoords, filtered, token, isExampleToken]);

  // Init map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: `mapbox://styles/mapbox/${mapStyle}`,
        center: [4.85, 45.75],
        zoom: 10,
        trackResize: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      
      // Forcer le redimensionnement avec un léger délai pour laisser le layout se stabiliser
      map.on('load', () => {
        setTimeout(() => {
          map.resize();
        }, 200);
      });

      mapRef.current = map;
      console.log("Mapbox instance created");
    } catch (e) {
      console.error("Mapbox init error", e);
    }
    return () => {
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Mettre à jour le style de la carte dynamiquement
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(`mapbox://styles/mapbox/${mapStyle}`);
  }, [mapStyle]);

  // Gestion des erreurs de jeton invalide
  useEffect(() => {
    const handleError = (e: any) => {
      if (e?.error?.status === 401) {
        toast.error("Le Token Mapbox est invalide ou a expiré.");
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Update markers + fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || filtered.length === 0) return;

    const apply = () => {
      // Nettoyage des anciennes racines React
      markerRootsRef.current.forEach(root => root.unmount());
      markerRootsRef.current = [];

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const bounds = new mapboxgl.LngLatBounds();
      filtered.forEach((t, i) => {
        const el = document.createElement("button");
        el.type = "button";
        
        const isLive = t.status === "en_cours";

        // On cherche la couleur de l'équipe, sinon on garde une couleur par défaut
        const teamColor = teamsData.find(tm => tm.name === t.team)?.color || 
                         (isLive ? "hsl(var(--accent))" : "hsl(var(--primary))");

        const color = teamColor;
        const label = t.project_number || String(i + 1);
        const isProjectNum = !!t.project_number;

        // Style ajusté pour accueillir la météo
        el.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:38px;padding:3px 6px;min-width:34px;border-radius:10px;background:${color};color:#fff;font-weight:800;font-size:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;white-space:nowrap;transition:transform 0.2s;`;

        // Ajout de l'animation de pulsation pour les chantiers en cours
        if (isLive) {
          el.className = "animate-pulse ring-4 ring-offset-2 ring-accent/30";
        }

        // Contenu du marqueur (Label + Météo)
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        labelSpan.style.lineHeight = "1";
        el.appendChild(labelSpan);

        const weatherCont = document.createElement("div");
        el.appendChild(weatherCont);

        const root = createRoot(weatherCont);
        root.render(
          <WeatherBadge 
            lat={t.lat} 
            lng={t.lng} 
            date={parseISO(t.scheduled_at)}
            requiresDryWeather={t.requires_dry_weather}
            variant="compact"
          />
        );
        markerRootsRef.current.push(root);

        // Utilisation de addEventListener au lieu de .onclick pour une meilleure compatibilité CSP
        const handleClick = (e: MouseEvent) => {
          e.preventDefault();
          setOpenTaskId(t.id);
        };
        el.addEventListener('click', handleClick);

        // Création du contenu du popup via le DOM plutôt que via une chaîne HTML brute
        const popupNode = document.createElement('div');
        popupNode.style.cssText = "font-family:inherit;font-size:12px";
        popupNode.innerHTML = `
          ${t.project_number ? `<div style="font-size:9px;font-weight:800;color:hsl(var(--primary));margin-bottom:2px">CHANTIER ${t.project_number}</div>` : ''}
          <strong>${t.title}</strong><br/>${t.client}<br/><span style="color:#666">${t.address}</span>
        `;

        const popup = new mapboxgl.Popup({ offset: 18, closeButton: false }).setDOMContent(popupNode);

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
  }, [filtered, teamsData]);

  const saveToken = () => {
    if (!tokenInput.trim()) return;
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserCoords([longitude, latitude]);
        if (mapRef.current) {
          // Mise à jour ou création du marqueur de position de l'agent
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([longitude, latitude]);
          } else {
            const el = document.createElement('div');
            el.className = "relative flex h-5 w-5";
            el.innerHTML = `
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white shadow-md"></span>
            `;
            
            userMarkerRef.current = new mapboxgl.Marker({ element: el, zIndexOffset: 999 })
              .setLngLat([longitude, latitude])
              .addTo(mapRef.current);
          }

          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            duration: 1500
          });
        }
        setIsLocating(false);
      },
      (error) => {
        toast.error("Impossible d'accéder à votre position. Vérifiez les permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (!mounted) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 shadow-sm"
            onClick={handleLocateUser}
            disabled={isLocating}
            title="Me localiser"
          >
            {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
          </Button>
          <div className="flex bg-muted rounded-md p-1 border shadow-sm w-fit">
            <Button 
              variant={mapStyle === "streets-v12" ? "default" : "ghost"} 
              size="sm" 
              className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setMapStyle("streets-v12")}
            >
              Plan
            </Button>
            <Button 
              variant={mapStyle === "satellite-streets-v12" ? "default" : "ghost"} 
              size="sm" 
              className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider"
              onClick={() => setMapStyle("satellite-streets-v12")}
            >
              Satellite
            </Button>
          </div>
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

      {(!token || isExampleToken) && (
        <Card className={isExampleToken ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {isExampleToken ? <AlertCircle className="h-4 w-4 text-destructive" /> : <KeyRound className="h-4 w-4" />}
              {isExampleToken ? "Jeton Mapbox invalide (Exemple)" : "Token Mapbox requis"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isExampleToken 
                ? "Le jeton actuel configuré dans le système est un exemple. Veuillez enregistrer votre propre clé pour activer la carte."
                : "Collez votre token public Mapbox (commence par pk.). Il sera mémorisé localement dans votre navigateur."}
              {" "}Récupérez-le sur{" "}
              <a className="underline font-medium" href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">account.mapbox.com</a>.
            </p>
            <div className="flex gap-2">
              <Input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="pk.eyJ1Ijoi..." />
              <Button onClick={saveToken}>Enregistrer</Button>
              {isExampleToken && <Button variant="ghost" onClick={clearToken}>Réinitialiser</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="relative p-0 h-[500px] w-full">
            <div ref={mapContainer} className="h-full w-full bg-secondary/10" />
            
            {q.isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/10 backdrop-blur-[2px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {active.length === 0 && token && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                <div className="mx-auto max-w-xs rounded-lg border bg-background p-4 text-center shadow-xl">
                  <MapPin className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Aucun point GPS à afficher</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Créez des chantiers avec coordonnées ou utilisez le bouton "Générer démo" dans les Paramètres.
                  </p>
                </div>
              </div>
            )}
            
            {/* Légende des équipes */}
            <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 rounded-lg border bg-background/90 p-3 shadow-lg backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Équipes actives</p>
              {teamsData.filter(td => teams.includes(td.name)).map(td => (
                <div key={td.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: td.color }} />
                  <span className="text-xs font-medium">{td.name}</span>
                </div>
              ))}
              {teams.length === 0 && <p className="text-[10px] italic">Aucune équipe assignée</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Liste des chantiers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {closestTask && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-primary p-1 text-primary-foreground">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plus proche</p>
                      <p className="text-xs font-bold truncate max-w-[120px]">{closestTask.task.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-primary">
                      {closestTask.distance < 1 ? `${Math.round(closestTask.distance * 1000)}m` : `${closestTask.distance.toFixed(1)}km`}
                    </p>
                    {isCalculatingRoute ? (
                      <p className="text-[10px] font-bold text-muted-foreground flex items-center justify-end gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calcul...
                      </p>
                    ) : closestTask && travelDurations[closestTask.task.id] !== undefined ? (
                      <p className="text-[10px] font-bold text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        ~{Math.round(travelDurations[closestTask.task.id] / 60)} min
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="gap-2" disabled={!closestTask}>
                        <ExternalLink className="h-4 w-4" /> Itinéraire
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${closestTask.task.lat},${closestTask.task.lng}&travelmode=driving`, '_blank')}>
                        Google Maps
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`https://www.waze.com/ul?ll=${closestTask.task.lat},${closestTask.task.lng}&navigate=yes`, '_blank')}>
                        Waze
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            {q.isLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 w-full animate-pulse rounded-md bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">Aucun chantier à afficher</p>
            ) : filtered.map((t, i) => {
              const distance = userCoords ? getDistance(userCoords[1], userCoords[0], t.lat, t.lng) : null;
              return (
                <div key={t.id} className="group relative rounded-md border bg-card p-2 transition-colors hover:bg-accent/10">
                  <button 
                    type="button" 
                    onClick={() => setOpenTaskId(t.id)} 
                    className="flex w-full items-start gap-2 text-left"
                  >
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground ${t.status === "en_cours" ? "bg-accent" : "bg-primary"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{t.title}</span>
                      <WeatherBadge 
                        lat={t.lat} 
                        lng={t.lng} 
                        date={parseISO(t.scheduled_at)}
                        requiresDryWeather={t.requires_dry_weather}
                      />
                      {distance !== null && (
                        <div className="flex flex-col items-end shrink-0">
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                            <Navigation className="h-2.5 w-2.5 fill-current" />
                            {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                          </span>
                          {travelDurations[t.id] !== undefined && (
                            <span className="flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground">
                              <Clock className="h-2 w-2" />
                              {Math.round(travelDurations[t.id] / 60)} min
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] h-4 py-0">{t.status === "en_cours" ? "en cours" : "planifié"}</Badge>
                    </div>
                    <div className="flex items-start gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate">{t.address}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(t.scheduled_at), "EEE d MMM HH'h'", { locale: fr })} · {t.team}
                    </div>
                  </div>
                  </button>
                  
                  <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-primary hover:bg-primary/20"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=driving`, '_blank')}>
                          Google Maps
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`https://www.waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`, '_blank')}>
                          Waze
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      <TaskDetailsSheet taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} />
    </div>
  );
}

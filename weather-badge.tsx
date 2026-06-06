import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AlertTriangle, Loader2, CloudOff, Droplets, Wind } from "lucide-react";
import { parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  isRainy: boolean;
  humidity: number;
  windSpeed: number;
}

// Schéma Zod pour valider la réponse d'OpenWeatherMap
const OpenWeatherSchema = z.object({
  list: z.array(z.object({
    dt: z.number(),
    main: z.object({
      temp: z.number(),
      humidity: z.number(),
    }),
    weather: z.array(z.object({
      main: z.string(),
      description: z.string(),
      icon: z.string(),
    })),
    wind: z.object({
      speed: z.number(),
    }),
  })),
});

interface WeatherBadgeProps {
  lat: number | null;
  lng: number | null;
  date: Date;
  requiresDryWeather?: boolean;
  variant?: "default" | "compact";
}

export function WeatherBadge({ lat, lng, date, requiresDryWeather, variant = "default" }: WeatherBadgeProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["weather", lat, lng, date.toDateString()],
    enabled: !!(lat && lng && import.meta.env.VITE_WEATHER_API_KEY),
    staleTime: 1000 * 60 * 30, // Garder en cache 30 minutes
    queryFn: async (): Promise<WeatherData> => {
      const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
      if (!apiKey) throw new Error("Clé API manquante");

      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=fr`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
      
      const json = await response.json();
      const parsed = OpenWeatherSchema.parse(json);

      const targetTs = date.getTime();
      const closest = parsed.list.reduce((prev, curr) => {
        return Math.abs(curr.dt * 1000 - targetTs) < Math.abs(prev.dt * 1000 - targetTs) ? curr : prev;
      });

      return {
        temp: closest.main.temp,
        description: closest.weather[0].description,
        icon: closest.weather[0].icon,
        isRainy: closest.weather[0].main === "Rain" || closest.weather[0].main === "Drizzle",
        humidity: closest.main.humidity,
        windSpeed: closest.wind.speed
      };
    }
  });

  if (!lat || !lng) return null;

  if (!import.meta.env.VITE_WEATHER_API_KEY) {
    return (
      <div className="flex items-center gap-1 opacity-40 grayscale" title="VITE_WEATHER_API_KEY manquante">
        <CloudOff className="h-3 w-3" />
        <span className="text-[8px]">API?</span>
      </div>
    );
  }

  if (isLoading) return <Loader2 className="h-3 w-3 animate-spin opacity-30" />;
  
  if (error || !data) {
    return <AlertTriangle className="h-3 w-3 text-amber-500 opacity-50" title="Erreur météo" />;
  }

  const isConflict = requiresDryWeather && data.isRainy;
  const description = data.description.charAt(0).toUpperCase() + data.description.slice(1);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {variant === "compact" ? (
            <div className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold cursor-help ${isConflict ? "bg-destructive text-white animate-bounce" : "bg-background/50 text-foreground"}`}>
              <img src={`https://openweathermap.org/img/wn/${data.icon}.png`} className="h-4 w-4" alt="" />
              <span>{Math.round(data.temp)}°</span>
            </div>
          ) : (
            <div 
              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 border shadow-sm cursor-help ${isConflict ? "bg-destructive/10 border-destructive text-destructive animate-pulse" : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"}`}
            >
              <img src={`https://openweathermap.org/img/wn/${data.icon}.png`} className="h-4 w-4" alt="" />
              <span className="text-[10px] font-bold">{Math.round(data.temp)}°C</span>
              {isConflict && <AlertTriangle className="h-3 w-3 fill-current" />}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent className="p-3 w-48 shadow-xl">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border pb-1.5 mb-1">
              <img src={`https://openweathermap.org/img/wn/${data.icon}.png`} className="h-8 w-8" alt="" />
              <div>
                <p className="text-xs font-bold leading-none">{description}</p>
                <p className="text-[10px] text-muted-foreground">Prévisions pour le chantier</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                <div className="text-[10px]">
                  <span className="block font-bold leading-none">{data.humidity}%</span>
                  <span className="text-[8px] text-muted-foreground uppercase font-medium">Humidité</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5 text-slate-400" />
                <div className="text-[10px]">
                  <span className="block font-bold leading-none">{Math.round(data.windSpeed * 3.6)} km/h</span>
                  <span className="text-[8px] text-muted-foreground uppercase font-medium">Vent</span>
                </div>
              </div>
            </div>

            {isConflict && (
              <div className="mt-1 flex items-start gap-1.5 rounded bg-destructive/10 p-1.5 text-destructive border border-destructive/20">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold leading-tight uppercase">
                  Alerte : Pluie prévue alors que le chantier nécessite un temps sec.
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
import { useQuery } from "@tanstack/react-query";
import { getForecast } from "@/lib/weather";
import { CloudRain, Sun, Cloud, AlertCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WeatherIndicatorProps {
  lat: number | null;
  lng: number | null;
  requiresDryWeather: boolean;
}

export function WeatherIndicator({ lat, lng, requiresDryWeather }: WeatherIndicatorProps) {
  const { data: weather, isLoading, isError } = useQuery({
    queryKey: ["weather", lat, lng],
    queryFn: () => (lat && lng ? getForecast(lat, lng) : null),
    enabled: !!(lat && lng),
    staleTime: 1000 * 60 * 30, // Cache de 30 minutes
  });

  if (!lat || !lng) return null;
  if (isLoading) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (isError || !weather) return null;

  // Détection de conflit : Il pleut et la tâche demande du temps sec
  const hasConflict = requiresDryWeather && weather.isRainy;

  const WeatherIcon = () => {
    if (weather.isRainy) return <CloudRain className="h-3 w-3 text-blue-500" />;
    if (weather.condition.includes("Clear")) return <Sun className="h-3 w-3 text-amber-500" />;
    return <Cloud className="h-3 w-3 text-slate-400" />;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 rounded-full bg-secondary/50 px-1.5 py-0.5">
              <WeatherIcon />
              <span className="text-[9px] font-medium">{Math.round(weather.temp)}°C</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{weather.condition} - Prévisions locales</p>
          </TooltipContent>
        </Tooltip>

        {hasConflict && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="animate-bounce">
                <AlertCircle className="h-3 w-3 text-destructive fill-destructive/10" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
              <p className="text-xs font-bold">Alerte Conflit Météo</p>
              <p className="text-[10px]">Cette tâche nécessite un temps sec mais de la pluie est prévue.</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
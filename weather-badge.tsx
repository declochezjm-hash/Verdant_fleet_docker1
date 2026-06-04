import { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, Wind, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { isSameDay, addDays } from "date-fns";

interface WeatherBadgeProps {
  lat: number | null;
  lng: number | null;
  date: Date;
  requiresDryWeather?: boolean;
  variant?: "default" | "compact";
}

const iconMap: Record<string, any> = {
  "01": Sun,            // ciel dégagé
  "02": Cloud,          // quelques nuages
  "03": Cloud,          // nuages épars
  "04": Cloud,          // nuages fragmentés
  "09": CloudRain,      // averse de pluie
  "10": CloudRain,      // pluie
  "11": CloudLightning, // orage
  "13": Wind,           // neige (utilisons Wind faute de mieux)
  "50": Wind,           // brouillard
};

export const WeatherBadge = ({ lat, lng, date, requiresDryWeather, variant = "default" }: WeatherBadgeProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isCompact = variant === "compact";

  const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
  const hasValidKey = !!apiKey && apiKey.length > 10;
  const isTooFar = date > addDays(new Date(), 5); // Limite de l'API gratuite OWM (5 jours)

  const { data: forecast, isLoading } = useQuery({
    queryKey: ["weather", lat, lng],
    queryFn: async () => {
      if (lat === null || lng === null || !hasValidKey) return null;
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=fr`
      );
      if (!response.ok) throw new Error("Météo indisponible");
      return response.json();
    },
    enabled: lat !== null && lng !== null && hasValidKey && !isTooFar,
    staleTime: 1000 * 60 * 30, // Mise en cache de 30 minutes
  });

  if (!mounted || lat === null || lng === null) return null;
  
  // Si pas de clé ou date trop loin, on affiche un état "inconnu" au lieu de null
  const noData = !hasValidKey || isTooFar;
  
  if (isLoading) return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />;

  const dayForecast = forecast?.list?.find((item: any) => 
    isSameDay(new Date(item.dt * 1000), date)
  ) || forecast?.list?.[0];

  if (!dayForecast || noData) {
    return isCompact ? null : (
      <div className="flex items-center gap-1 text-[9px] font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground opacity-50">
        <HelpCircle className="w-2.5 h-2.5" />
        <span>--°C</span>
      </div>
    );
  }

  const iconCode = dayForecast.weather[0].icon.substring(0, 2);
  const Icon = iconMap[iconCode] || HelpCircle;
  const temp = Math.round(dayForecast.main.temp);
  const description = dayForecast.weather[0].description;
  const isRainy = ["09", "10", "11"].includes(iconCode);
  const hasConflict = requiresDryWeather && isRainy;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-[9px] font-bold transition-colors ${
            isCompact ? "" : "px-1 py-0.5 rounded"
          } ${
            hasConflict 
              ? "bg-destructive text-destructive-foreground animate-bounce" 
              : isCompact ? "text-white" : "bg-secondary/80 text-secondary-foreground"
          }`}>
            {hasConflict ? <AlertTriangle className="w-2.5 h-2.5" /> : <Icon className="w-2.5 h-2.5" />}
            <span>{temp}°C</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-bold capitalize">{description}</p>
            <p>{temp}°C (Ressenti {Math.round(dayForecast.main.feels_like)}°C)</p>
            {hasConflict && <p className="text-destructive font-bold mt-1">⚠️ Temps sec requis</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
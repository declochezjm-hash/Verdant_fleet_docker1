/**
 * Service de récupération météo pour le Smart Scheduling
 */

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export interface WeatherData {
  temp: number;
  condition: string;
  isRainy: boolean;
}

export async function getForecast(lat: number, lon: number): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) return null;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=fr`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.weather || data.weather.length === 0) {
      return null;
    }

    const mainCondition = data.weather[0].main;
    // On considère comme "pluvieux" tout ce qui peut empêcher une tonte ou un traitement
    const rainConditions = ['Rain', 'Drizzle', 'Thunderstorm', 'Snow'];

    return {
      temp: data.main.temp,
      condition: data.weather[0].description || mainCondition,
      isRainy: rainConditions.includes(mainCondition),
    };
  } catch (error) {
    console.error("Erreur météo:", error);
    return null;
  }
}
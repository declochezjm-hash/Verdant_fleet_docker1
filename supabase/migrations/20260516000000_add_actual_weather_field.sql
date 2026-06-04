-- Ajout du champ météo constatée
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS actual_weather TEXT,
ADD COLUMN IF NOT EXISTS weather_alert_status TEXT DEFAULT 'ok';
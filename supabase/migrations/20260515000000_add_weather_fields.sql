-- Migration pour le Smart Scheduling
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS requires_dry_weather BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.tasks.requires_dry_weather IS 'Indique si la tâche nécessite des conditions météorologiques sèches (ex: tonte, phyto).';
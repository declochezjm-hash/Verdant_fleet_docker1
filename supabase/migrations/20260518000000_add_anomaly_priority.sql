-- Migration pour ajouter la priorité aux anomalies
ALTER TABLE public.anomalies ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normale';
COMMENT ON COLUMN public.anomalies.priority IS 'Priorité du signalement : normale ou urgente';
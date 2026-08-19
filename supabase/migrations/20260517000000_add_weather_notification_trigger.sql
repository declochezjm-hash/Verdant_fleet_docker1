-- Activer l'extension pour les requêtes HTTP (nécessaire pour les Webhooks SQL)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Fonction qui sera appelée par le trigger
CREATE OR REPLACE FUNCTION public.handle_weather_mismatch_notification()
RETURNS trigger AS $$
BEGIN
  -- On ne déclenche la notification que si le statut passe à 'mismatch' 
  -- et qu'il n'y était pas déjà (pour éviter les doublons)
  IF NEW.weather_alert_status = 'mismatch' AND (OLD.weather_alert_status IS DISTINCT FROM 'mismatch') THEN
    PERFORM net.http_post(
      url := 'https://[VOTRE_PROJECT_ID].functions.supabase.co/weather-alert-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || '[VOTRE_ANON_OU_SERVICE_KEY]' 
      ),
      body := jsonb_build_object(
        'task_id', NEW.id,
        'task_title', NEW.title,
        'client', NEW.client,
        'actual_weather', NEW.actual_weather
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur la table tasks
CREATE TRIGGER tr_on_weather_mismatch_alert
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_weather_mismatch_notification();
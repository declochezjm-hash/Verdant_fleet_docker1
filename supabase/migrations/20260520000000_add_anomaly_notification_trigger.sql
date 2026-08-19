-- Activer l'extension pour les requêtes HTTP si pas déjà fait
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Fonction qui appelle l'Edge Function de notification
CREATE OR REPLACE FUNCTION public.handle_anomaly_notification()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://[VOTRE_PROJECT_ID].functions.supabase.co/push-notifier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '[VOTRE_SERVICE_ROLE_KEY]' 
    ),
    body := jsonb_build_object(
      'title', 'Alerte Matériel : ' || (SELECT name FROM equipment WHERE id = NEW.equipment_id),
      'body', NEW.description,
      'type', 'ANOMALY_REPORTED',
      'task_id', NEW.task_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger au moment de l'insertion d'une anomalie
CREATE TRIGGER tr_on_anomaly_reported
  AFTER INSERT ON public.anomalies
  FOR EACH ROW EXECUTE FUNCTION public.handle_anomaly_notification();
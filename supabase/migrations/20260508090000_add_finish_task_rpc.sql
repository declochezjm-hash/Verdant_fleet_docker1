-- Fonction pour clôturer un chantier de manière atomique
CREATE OR REPLACE FUNCTION public.finish_task(
  p_task_id uuid,
  p_notes text,
  p_signature_url text,
  p_products jsonb, -- Format: [{"productId": "...", "quantity": 10, "lot": "...", "dose": 0.5}, ...]
  p_actual_weather text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prod_record jsonb;
  v_duration float;
BEGIN
  -- Récupération de la durée de la tâche pour incrémenter les compteurs matériel
  SELECT duration INTO v_duration FROM public.tasks WHERE id = p_task_id;

  -- 1. Mise à jour de la tâche (Statut et métadonnées)
  UPDATE public.tasks
  SET 
    status = 'termine',
    notes = p_notes,
    signature_url = p_signature_url,
    actual_weather = p_actual_weather,
    weather_alert_status = CASE 
      WHEN requires_dry_weather = true AND p_actual_weather = 'Pluie' THEN 'mismatch'
      ELSE 'ok'
    END,
    finished_at = now(),
    -- Calcul automatique du coût de main d'oeuvre basé sur les taux actuels des profils assignés
    labor_cost = (
      SELECT SUM(p.hourly_rate * t.duration)
      FROM public.task_assignments ta
      JOIN public.profiles p ON p.id = ta.user_id
      WHERE ta.task_id = public.tasks.id
    )
  WHERE id = p_task_id;

  -- 2. Enregistrement des consommations et mise à jour des stocks
  FOR prod_record IN SELECT * FROM jsonb_array_elements(p_products)
  LOOP
    INSERT INTO public.task_products (task_id, product_id, quantity, lot_number, dose_per_m2)
    VALUES (
      p_task_id, 
      (prod_record->>'productId')::uuid, 
      (prod_record->>'quantity')::numeric,
      prod_record->>'lot',
      (prod_record->>'dose')::numeric
    );

    UPDATE public.products
    SET stock = stock - (prod_record->>'quantity')::numeric
    WHERE id = (prod_record->>'productId')::uuid;
  END LOOP;

  -- 3. Mise à jour des heures d'utilisation du matériel et bascule automatique en maintenance
  UPDATE public.equipment
  SET 
    hours_used = hours_used + v_duration,
    status = CASE 
      WHEN (hours_used + v_duration) >= hours_for_maintenance AND status = 'OK' 
      THEN 'Maintenance requise'::public.equipment_status 
      ELSE status 
    END
  WHERE id IN (SELECT equipment_id FROM public.task_equipment WHERE task_id = p_task_id);
END;
$$;
-- Fonction pour clôturer un chantier de manière atomique
CREATE OR REPLACE FUNCTION public.finish_task(
  p_task_id uuid,
  p_notes text,
  p_signature_url text,
  p_products jsonb -- Format: [{"productId": "...", "quantity": 10, "lot": "...", "dose": 0.5}, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prod_record jsonb;
BEGIN
  -- 1. Mise à jour de la tâche (Statut et métadonnées)
  UPDATE public.tasks
  SET 
    status = 'termine',
    notes = p_notes,
    signature_url = p_signature_url,
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
END;
$$;
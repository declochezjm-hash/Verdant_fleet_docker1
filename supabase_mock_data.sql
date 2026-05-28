-- SCRIPT DE GÉNÉRATION DE DONNÉES FICTIVES POUR VERDANT FLEET

-- 1. Insertion de Produits (Inventaire)
INSERT INTO public.products (name, amm_number, category, unit, stock, threshold, price_per_unit)
VALUES 
('Azote Liquide 20-10-10', NULL, 'Engrais', 'L', 150.5, 50, 4.50),
('Gazon Sport Haute Résistance', NULL, 'Semences', 'Kg', 200, 40, 12.00),
('Désherbant Systémique Pro', '2110045', 'Phyto', 'L', 25.0, 10, 45.00),
('Fongicide Gazon 500', '2150089', 'Phyto', 'L', 12.0, 5, 65.00),
('Terreau de Plantation', NULL, 'Engrais', 'Sac', 80, 20, 8.50);

-- 2. Insertion de Matériel (Flotte)
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES 
('Tondeuse Auto-portée John Deere', 'Tondeuse', 85, 100, 'OK', 15.50),
('Souffleur thermique Stihl BR600', 'Souffleur', 42, 50, 'OK', 5.00),
('Taille-haie perche Husqvarna', 'Taille-haie', 110, 100, 'Maintenance requise', 8.00),
('Camion Benne Iveco', 'Véhicule', 1250, 5000, 'OK', 25.00),
('Pulvérisateur Électrique 15L', 'Pulvérisateur', 15, 40, 'OK', 3.50);

-- 3. Insertion de Chantiers (Tasks)
-- Note: gen_random_uuid() est utilisé pour les IDs
INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget)
VALUES 
-- Chantier terminé (pour tester Admin Analytics)
(gen_random_uuid(), 'Tonte et Finition Parc Central', 'Mairie de Lyon', 'Place Bellecour, 69002 Lyon', NOW() - INTERVAL '2 days', 4, 'Équipe Nord', 'termine', 450.00),

-- Chantier en cours (pour tester Agent View)
(gen_random_uuid(), 'Plantation de massifs', 'Résidence les Glycines', '12 Rue des Fleurs, 69003 Lyon', NOW(), 6, 'Équipe Nord', 'en_cours', 1200.00),

-- Chantier planifié (pour tester Coordinator Dashboard)
(gen_random_uuid(), 'Traitement Phyto Stade Municipal', 'Ville de Villeurbanne', 'Rue de la Soie, 69100 Villeurbanne', NOW() + INTERVAL '1 day', 3, 'Équipe Sud', 'planifie', 350.00);

-- 4. Simulation de consommations pour le chantier terminé
DO $$
DECLARE
    v_task_id uuid;
    v_prod_id uuid;
BEGIN
    SELECT id INTO v_task_id FROM public.tasks WHERE status = 'termine' LIMIT 1;
    SELECT id INTO v_prod_id FROM public.products WHERE name = 'Azote Liquide 20-10-10' LIMIT 1;
    
    IF v_task_id IS NOT NULL AND v_prod_id IS NOT NULL THEN
        INSERT INTO public.task_products (task_id, product_id, quantity, lot_number, dose_per_m2)
        VALUES (v_task_id, v_prod_id, 10.0, 'LOT-2024-01', 0.5)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 5. Affectation de matériel au chantier terminé (pour amortissement)
DO $$
DECLARE
    v_task_id uuid;
    v_equip_id uuid;
BEGIN
    SELECT id INTO v_task_id FROM public.tasks WHERE status = 'termine' LIMIT 1;
    SELECT id INTO v_equip_id FROM public.equipment WHERE name = 'Tondeuse Auto-portée John Deere' LIMIT 1;
    
    IF v_task_id IS NOT NULL AND v_equip_id IS NOT NULL THEN
        INSERT INTO public.task_equipment (task_id, equipment_id)
        VALUES (v_task_id, v_equip_id)
        ON CONFLICT (task_id, equipment_id) DO NOTHING;
    END IF;
END $$;

-- INSTRUCTIONS POUR LIER À VOTRE UTILISATEUR :
-- Pour voir les chantiers dans votre vue "Agent", vous devez les assigner à votre ID.
-- 1. Allez dans Authentication > Users et copiez votre ID.
-- 2. Exécutez la commande suivante en remplaçant 'VOTRE_ID_ICI' :

/*
INSERT INTO public.task_assignments (task_id, user_id)
SELECT id, 'VOTRE_ID_ICI'::uuid FROM public.tasks;

UPDATE public.profiles 
SET hourly_rate = 45, team = 'Équipe Nord' 
WHERE id = 'VOTRE_ID_ICI'::uuid;
*/
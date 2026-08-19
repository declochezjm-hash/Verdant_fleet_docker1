-- SCRIPT DE PEUPLEMENT COMPLET POUR TESTER L'APPLI VERDANT FLEET

-- 1. Nettoyage partiel (Optionnel - à commenter si tu veux garder tes données actuelles)
-- TRUNCATE public.task_products, public.task_equipment, public.task_assignments, public.tasks, public.anomalies, public.maintenance_logs, public.equipment, public.products CASCADE;

-- 2. Insertion de Produits (Inventaire diversifié)
INSERT INTO public.products (name, amm_number, category, unit, stock, threshold, price_per_unit)
VALUES 
('Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150.5, 50, 5.25) ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, amm_number, category, unit, stock, threshold, price_per_unit)
VALUES ('Engrais Granulé Gazon (Sac 25kg)', NULL, 'Engrais', 'Sac', 45, 10, 32.00) ON CONFLICT DO NOTHING;
INSERT INTO public.products (name, amm_number, category, unit, stock, threshold, price_per_unit)
VALUES ('Herbistop Phyto (Bio-contrôle)', '2110045', 'Phyto', 'L', 18.0, 5, 48.00) ON CONFLICT DO NOTHING;

-- 3. Insertion de Matériel (Flotte avec différents états)
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES 
('Tondeuse Kubota G23', 'Tondeuse', 210, 250, 'OK', 18.00) ON CONFLICT DO NOTHING;
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES ('Tondeuse Honda HRX', 'Tondeuse', 145, 150, 'Maintenance requise', 12.00) ON CONFLICT DO NOTHING;
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES ('Camion Renault Master', 'Camion', 820, 1000, 'OK', 35.00) ON CONFLICT DO NOTHING;
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES ('Tronçonneuse Stihl MS261', 'Tronçonneuse', 95, 100, 'Maintenance requise', 8.00) ON CONFLICT DO NOTHING;
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES ('Débroussailleuse Husqvarna', 'Débroussailleuse', 60, 120, 'OK', 6.00) ON CONFLICT DO NOTHING;
INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
VALUES ('Taille-haie Stihl HS82', 'Taille-haie', 30, 80, 'OK', 5.00) ON CONFLICT DO NOTHING;

-- 4. Insertion de Chantiers (Mélange de statuts pour les Dashboards)
-- IDs fixés pour les jointures suivantes
INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget, labor_cost, notes)
VALUES 
-- Chantier Terminé 1 (Bénéficiaire)
('11111111-1111-1111-1111-111111111111', 'Tonte & Taille Résidence Parc', 'Copropriété Les Pins', '42 Avenue de la République, Lyon', NOW() - INTERVAL '3 days', 4, 'Équipe Nord', 'termine', 650.00, 280.00, 'Rien à signaler. Client satisfait.')
ON CONFLICT (id) DO NOTHING;

-- Chantier Terminé 2 (Déficitaire ou limite)
INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget, labor_cost, notes)
VALUES ('22222222-2222-2222-2222-222222222222', 'Traitement Phyto Stade', 'Ville de Villeurbanne', 'Rue du Stade, Villeurbanne', NOW() - INTERVAL '1 day', 3, 'Équipe Sud', 'termine', 400.00, 210.00, 'Beaucoup de vent, consommation produit plus élevée.')
ON CONFLICT (id) DO NOTHING;

-- Chantier En Cours
INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget, labor_cost, notes)
VALUES ('33333333-3333-3333-3333-333333333333', 'Aménagement Massifs', 'Mme. Durand', '12 Rue des Lilas, Bron', NOW(), 6, 'Équipe Nord', 'en_cours', 1500.00, NULL, 'Début de plantation ce matin.')
ON CONFLICT (id) DO NOTHING;

-- Chantier Planifié
INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget, labor_cost, notes)
VALUES ('44444444-4444-4444-4444-444444444444', 'Entretien Mensuel Square', 'Mairie de Vénissieux', 'Square de la Liberté, Vénissieux', NOW() + INTERVAL '1 day', 5, 'Équipe Sud', 'planifie', 800.00, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Consommation de Produits (Lien avec chantiers terminés)
INSERT INTO public.task_products (task_id, product_id, quantity, lot_number, dose_per_m2)
SELECT '11111111-1111-1111-1111-111111111111', id, 2.5, 'LOT-AZ-2024', 0.2 FROM public.products WHERE name = 'Azote Liquide Pro 20L' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.task_products (task_id, product_id, quantity, lot_number, dose_per_m2)
SELECT '22222222-2222-2222-2222-222222222222', id, 5.0, 'LOT-PHY-88', 0.5 FROM public.products WHERE name = 'Herbistop Phyto (Bio-contrôle)' LIMIT 1
ON CONFLICT DO NOTHING;

-- 6. Matériel rattaché aux chantiers (pour amortissement)
INSERT INTO public.task_equipment (task_id, equipment_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM public.equipment WHERE name = 'Tondeuse Auto-portée Kubota G23' LIMIT 1
ON CONFLICT (task_id, equipment_id) DO NOTHING;

INSERT INTO public.task_equipment (task_id, equipment_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM public.equipment WHERE name = 'Pulvérisateur Électrique 15L' LIMIT 1
ON CONFLICT (task_id, equipment_id) DO NOTHING;

-- 7. Maintenance & Historique
INSERT INTO public.maintenance_logs (equipment_id, type, description, cost, date)
SELECT id, 'Révision', 'Vidange complète et affûtage des lames', 145.00, CURRENT_DATE - INTERVAL '2 months' 
FROM public.equipment WHERE name = 'Tondeuse Kubota G23' LIMIT 1;

-- 8. Anomalies signalées
INSERT INTO public.anomalies (task_id, equipment_id, description, resolved)
SELECT '33333333-3333-3333-3333-333333333333', id, 'Fumée noire inhabituelle au démarrage', false 
FROM public.equipment WHERE name = 'Tondeuse Honda HRX 537' LIMIT 1;

-- 9. NOTE IMPORTANTE POUR L'UTILISATEUR
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- On récupère l'ID du premier utilisateur pour automatiser le lien
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Attribution du rôle Coordinateur
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'coordinator')
        ON CONFLICT (user_id, role) DO NOTHING;

        -- Mise à jour du profil
        UPDATE public.profiles SET team = 'Équipe Nord' WHERE id = v_user_id;

        -- Affectation de tout le matériel à l''utilisateur actuel pour le test
        UPDATE public.equipment 
        SET assigned_to = v_user_id 
        WHERE name IN ('Tondeuse Honda HRX', 'Camion Renault Master', 'Tronçonneuse Stihl MS261', 'Débroussailleuse Husqvarna');

        -- Assignation aux chantiers de test pour la vue Agent et les RLS
        INSERT INTO public.task_assignments (task_id, user_id)
        VALUES 
        ('11111111-1111-1111-1111-111111111111', v_user_id),
        ('22222222-2222-2222-2222-222222222222', v_user_id),
        ('33333333-3333-3333-3333-333333333333', v_user_id)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Données liées avec succès à l utilisateur %', v_user_id;
    END IF;
END $$;
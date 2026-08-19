SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict jMcLJc7jVXL4siTg5moJrLKC3br8mM0vidIu3Tn0lYGs8PPDNVe8brNDra9C3FL

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "name", "team", "hourly_rate", "created_at", "email", "last_login_at", "is_blocked", "is_active", "avatar_url") VALUES
	('6fdbc68e-8fd1-46cb-8463-e499255be938', 'paul', 'Équipe Nord', 35, '2026-06-04 10:52:35.614621+00', NULL, NULL, false, true, NULL),
	('5a1f6ec0-03f2-41e9-a9d6-989053faf26f', 'paul1', 'Équipe Sud', 35, '2026-06-29 15:22:08.109319+00', 'declochez.jm@gmail.com', NULL, false, true, NULL),
	('7aedfc8a-5c90-4e10-94df-628a05b3520d', 'Coordinateur Principal', NULL, 35, '2026-05-25 08:20:46.252046+00', NULL, '2026-08-19 17:20:06.068969+00', false, true, NULL);


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."equipment" ("id", "name", "type", "assigned_to", "hours_used", "hours_for_maintenance", "status", "last_maintenance", "hourly_cost", "created_at", "team", "is_archived", "internal_id", "motorization_type") VALUES
	('21043bcf-bcbe-4c89-bfe5-c7b167e433ff', 'Pulvérisateur Électrique 15L', 'Pulvérisateur', NULL, 0, 40, 'OK', '2026-05-25', 3.5, '2026-05-25 09:13:15.788491+00', NULL, false, 'EQ-008', NULL),
	('add181a7-183d-457e-9101-bdd0193715bd', 'Pulvérisateur Électrique 15L', 'Pulvérisateur', NULL, 0, 50, 'OK', '2026-05-25', 2.5, '2026-05-25 09:52:58.868399+00', NULL, false, 'EQ-009', NULL),
	('3c2aa926-e854-49b0-a91c-27f514ca1218', 'Souffleur Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-05-25', 4.5, '2026-05-25 09:52:58.868399+00', NULL, false, 'EQ-012', NULL),
	('7e0e9d15-4314-4190-9c0e-1eb4d33e90f2', 'Souffleur thermique Stihl BR600', 'Souffleur', NULL, 0, 50, 'OK', '2026-05-25', 5, '2026-05-25 09:13:15.788491+00', NULL, false, 'EQ-014', NULL),
	('cf5ac884-12a8-4cff-a509-9c92b08a1449', 'Taille-haie perche Husqvarna', 'Taille-haie', NULL, 0, 100, 'OK', '2026-05-25', 6, '2026-05-25 10:01:49.668026+00', NULL, false, 'EQ-018', NULL),
	('fd52c30a-dc7a-40c3-a7a8-d4ae969dbb5e', 'Taille-haie perche Husqvarna', 'Taille-haie', NULL, 0, 100, 'OK', '2026-05-25', 6, '2026-05-25 10:08:03.882834+00', NULL, false, 'EQ-019', NULL),
	('843127ac-d3a2-4baa-b3b8-b77486732dc3', 'Taille-haie perche Husqvarna', 'Taille-haie', NULL, 0, 100, 'OK', '2026-05-25', 6, '2026-05-25 09:52:58.868399+00', NULL, false, 'EQ-020', NULL),
	('9c24b546-745c-4dd9-b9aa-3f19f4acf22c', 'Taille-haie perche Husqvarna', 'Taille-haie', NULL, 0, 100, 'OK', '2026-05-25', 8, '2026-05-25 09:13:15.788491+00', NULL, false, 'EQ-021', NULL),
	('00ff0834-a408-447c-9dc1-4c4a47e5eddd', 'Tondeuse Auto-portée John Deere', 'Tondeuse', NULL, 0, 100, 'OK', '2026-05-25', 15.5, '2026-05-25 09:13:15.788491+00', NULL, false, 'EQ-022', NULL),
	('f05c12a0-155e-4c2b-9478-0f40e6aead25', 'Tondeuse Auto-portée Kubota G23', 'Tondeuse', NULL, 0, 250, 'En panne', '2026-05-25', 18, '2026-05-25 10:01:49.668026+00', NULL, false, 'EQ-024', NULL),
	('49a0ac27-8913-4144-b35a-220714d70e82', 'Tondeuse Honda HRX 537', 'Tondeuse', NULL, 0, 100, 'En panne', '2026-05-25', 12, '2026-05-25 09:52:58.868399+00', NULL, false, 'EQ-027', NULL),
	('02f3fb54-4b73-447f-9172-dcd8bf29affb', 'Camion Benne Renault Master', 'Véhicule', NULL, 0, 20000, 'OK', '2026-05-25', 35, '2026-05-25 09:52:58.868399+00', 'Équipe Nord', false, 'EQ-002', NULL),
	('110203b9-b619-4cba-9d21-edf159da0a27', 'Tondeuse Auto-portée Kubota G23', 'Tondeuse', NULL, 0, 250, 'En panne', '2026-05-25', 18, '2026-05-25 09:52:58.868399+00', 'Équipe Nord', false, 'EQ-025', NULL),
	('6c27dc3d-d344-441d-ab6c-4aaed1e42591', 'Kubota G23', 'Tondeuse', NULL, 0, 250, 'OK', '2026-06-02', 18, '2026-06-02 08:06:02.472342+00', NULL, false, 'EQ-006', NULL),
	('e425e317-c4ca-42e5-8809-49f9d2fac690', 'Kubota G23', 'Tondeuse', NULL, 0, 250, 'OK', '2026-05-31', 18, '2026-05-31 09:33:47.232649+00', NULL, false, 'EQ-007', NULL),
	('e99e4828-5301-400c-ad37-ce515edb2746', 'Souffleur Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-05-25', 4.5, '2026-05-25 10:08:03.882834+00', NULL, false, 'EQ-011', NULL),
	('effbd920-2d70-4c12-8e2e-c014fae4c937', 'Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-06-02', 4.5, '2026-06-02 08:06:02.472342+00', NULL, false, 'EQ-015', NULL),
	('f78764bf-34b0-4d7e-ab90-a7c1ac5a18f6', 'Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-05-31', 4.5, '2026-05-31 09:33:47.232649+00', NULL, false, 'EQ-016', NULL),
	('5ed14688-d601-4c91-8a3a-4b68599af225', 'Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-06-02', 4.5, '2026-06-02 10:58:50.160212+00', NULL, false, 'EQ-017', NULL),
	('8a127ac7-297c-4fe2-87a0-7e9f49ae7107', 'Tondeuse Auto-portée Kubota G23', 'Tondeuse', NULL, 0, 250, 'En panne', '2026-05-25', 18, '2026-05-25 10:08:03.882834+00', NULL, false, 'EQ-023', NULL),
	('b814b6d2-e240-4ee2-899a-ee44a0b51930', 'Kubota G23', 'Tondeuse', NULL, 0, 250, 'OK', '2026-06-02', 18, '2026-06-02 10:58:50.160212+00', 'Équipe Nord', false, 'EQ-005', NULL),
	('d6637f6d-b9c9-4e7c-861d-d29d6a58e1d3', 'Camion Benne Iveco', 'Véhicule', NULL, 0, 5000, 'OK', '2026-05-25', 25, '2026-05-25 09:13:15.788491+00', 'Équipe Nord', false, 'EQ-001', NULL),
	('e1111111-1111-1111-1111-111111111111', 'Kubota G23', 'Tondeuse', NULL, 0, 250, 'OK', '2026-05-25', 15, '2026-05-25 10:18:16.413052+00', NULL, false, 'EQ-004', NULL),
	('6d4c94a9-5af2-4ffc-8fa3-d448e2c33918', 'Pulvérisateur Électrique 15L', 'Pulvérisateur', NULL, 0, 50, 'OK', '2026-05-25', 2.5, '2026-05-25 10:01:49.668026+00', NULL, false, 'EQ-010', NULL),
	('fade62c8-f28e-49e4-86ca-d8dd1954229d', 'Souffleur Stihl BR800', 'Souffleur', NULL, 0, 50, 'OK', '2026-05-25', 4.5, '2026-05-25 10:01:49.668026+00', NULL, false, 'EQ-013', NULL),
	('6182edff-a84f-489f-a03a-94438ba92139', 'Tondeuse Honda HRX 537', 'Tondeuse', NULL, 0, 100, 'En panne', '2026-05-25', 12, '2026-05-25 10:01:49.668026+00', NULL, false, 'EQ-026', NULL),
	('7db62860-88d5-4ba1-8f88-6bfe7fcbec8d', 'Camion Benne Renault Master', 'Véhicule', NULL, 0, 20000, 'OK', '2026-05-25', 35, '2026-05-25 10:01:49.668026+00', 'Équipe Nord', false, 'EQ-003', NULL);


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tasks" ("id", "title", "client", "address", "lat", "lng", "scheduled_at", "duration", "team", "status", "started_at", "finished_at", "budget", "labor_cost", "notes", "signature_url", "photo_before_url", "photo_after_url", "created_at", "priority", "requires_dry_weather", "actual_weather", "weather_alert_status", "project_number") VALUES
	('30e9125f-4284-41a0-9cb7-52c9acaf83b4', 'Tonte et Finition Parc Central', 'Mairie de Lyon', 'Place Bellecour, 69002 Lyon', 45.792394648660675, 4.861139720867079, '2026-05-23 09:13:15.788491+00', 4, 'Équipe Nord', 'termine', NULL, NULL, 450, NULL, NULL, NULL, NULL, NULL, '2026-05-25 09:13:15.788491+00', 'normale', false, NULL, 'ok', NULL),
	('11111111-1111-1111-1111-111111111111', 'Tonte & Taille Résidence Parc', 'Copropriété Les Pins', '42 Avenue de la République, Lyon', 45.76341025704238, 4.830531457777272, '2026-05-22 09:52:58.868399+00', 4, 'Équipe Nord', 'termine', NULL, NULL, 650, 280, 'Rien à signaler. Client satisfait.', NULL, NULL, NULL, '2026-05-25 09:52:58.868399+00', 'normale', false, NULL, 'ok', NULL),
	('22222222-2222-2222-2222-222222222222', 'Traitement Phyto Stade', 'Ville de Villeurbanne', 'Rue du Stade, Villeurbanne', 45.79738092670163, 4.859099575027821, '2026-05-24 09:52:58.868399+00', 3, 'Équipe Sud', 'termine', NULL, NULL, 400, 210, 'Beaucoup de vent, consommation produit plus élevée.', NULL, NULL, NULL, '2026-05-25 09:52:58.868399+00', 'normale', false, NULL, 'ok', NULL),
	('a1111111-1111-1111-1111-111111111111', 'Tonte Résidence', 'Copropriété Les Pins', 'Lyon', 45.7890906085368, 4.87073084779464, '2026-05-28 07:33:00+00', 5, 'Équipe Nord', 'termine', NULL, NULL, 650, 280, '', NULL, NULL, NULL, '2026-05-31 09:33:47.232649+00', 'normale', true, NULL, 'ok', 'C2026-06'),
	('fc6c5079-0188-44d6-8768-d2e411002e98', 'Plantation de massifs', 'Résidence les Glycines', '12 Rue des Fleurs, 69003 Lyon', 45.775197067848254, 4.839432572414379, '2026-05-25 09:13:15.788491+00', 6, 'Équipe Nord', 'termine', NULL, '2026-05-30 16:42:28.275+00', 1200, NULL, NULL, NULL, NULL, NULL, '2026-05-25 09:13:15.788491+00', 'normale', false, NULL, 'ok', NULL),
	('68b1208e-3553-4548-979a-47f9e1ca37c0', 'Traitement Phyto Stade Municipal', 'Ville de Villeurbanne', 'Rue de la Soie, 69100 Villeurbanne', 45.7537683249803, 4.85284772226685, '2026-05-26 05:13:00+00', 3, 'Équipe Nord', 'en_cours', '2026-06-22 14:12:20.402+00', NULL, 350, NULL, '', NULL, NULL, NULL, '2026-05-25 09:13:15.788491+00', 'normale', false, NULL, 'ok', NULL),
	('33333333-3333-3333-3333-333333333333', 'Aménagement Massifs', 'Mme. Durand', '12 Rue des Lilas, Bron', 45.77682016955031, 4.876535197400825, '2026-05-25 09:52:58.868399+00', 6, 'Équipe Nord', 'termine', NULL, '2026-06-01 16:22:12.646+00', 1500, NULL, 'Début de plantation ce matin.', NULL, NULL, NULL, '2026-05-25 09:52:58.868399+00', 'normale', false, NULL, 'ok', NULL),
	('a2222222-2222-2222-2222-222222222222', 'Aménagement Massifs', 'Mme. Durand', '1 Rue Mercière, 69002 Lyon, France', 45.764646, 4.832306, '2026-06-05 11:33:00+00', 6, 'Équipe Nord', 'termine', NULL, '2026-06-22 14:12:39.234+00', 1500, NULL, '', NULL, NULL, NULL, '2026-05-31 09:33:47.232649+00', 'normale', true, NULL, 'ok', 'C2026-01'),
	('0bab371f-b565-41b2-8ea8-115d45766e70', 'ess', 'ess', 'Chemin Des Ricardies, 87110 Solignac, France', 45.76571, 1.275696, '2026-06-30 04:00:00+00', 2, 'Équipe Nord', 'planifie', NULL, NULL, 0, NULL, '', NULL, NULL, NULL, '2026-06-24 06:10:03.159164+00', 'normale', false, NULL, 'ok', 'C2026-07'),
	('44444444-4444-4444-4444-444444444444', 'Entretien Mensuel Square', 'Mairie de Vénissieux', 'Allée Du Grand Camp, 69006 Lyon, France', 45.777912, 4.855654, '2026-06-23 23:52:00+00', 5, 'Équipe Sud', 'en_cours', '2026-06-04 16:15:42.418+00', NULL, 1200, NULL, '', NULL, NULL, NULL, '2026-05-25 09:52:58.868399+00', 'normale', true, NULL, 'ok', 'C2026-05');


--
-- Data for Name: anomalies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."anomalies" ("id", "task_id", "equipment_id", "reported_by", "description", "resolved", "created_at", "repair_notes") VALUES
	('3185b02b-1aaf-4776-8e60-1a216f9ff0fe', '33333333-3333-3333-3333-333333333333', '49a0ac27-8913-4144-b35a-220714d70e82', NULL, 'Fumée noire inhabituelle au démarrage', false, '2026-05-25 09:52:58.868399+00', NULL),
	('7891fbed-27ae-4419-bc8e-6f2ec5602ba0', '33333333-3333-3333-3333-333333333333', '49a0ac27-8913-4144-b35a-220714d70e82', NULL, 'Fumée noire inhabituelle au démarrage', false, '2026-05-25 10:01:49.668026+00', NULL),
	('a5aa2977-b923-4232-b27a-d0a5bced25b3', '33333333-3333-3333-3333-333333333333', '49a0ac27-8913-4144-b35a-220714d70e82', NULL, 'Fumée noire inhabituelle au démarrage', false, '2026-05-25 10:08:03.882834+00', NULL);


--
-- Data for Name: eco_wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: jarvis_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: maintenance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."maintenance_logs" ("id", "equipment_id", "date", "type", "description", "cost") VALUES
	('bc14c26a-3588-4204-9a19-898b4e4313c4', '110203b9-b619-4cba-9d21-edf159da0a27', '2026-03-25', 'Révision', 'Vidange complète et affûtage des lames', 145),
	('8606b2fa-6738-42ba-b367-3c0bf1cce566', '110203b9-b619-4cba-9d21-edf159da0a27', '2026-03-25', 'Révision', 'Vidange complète et affûtage des lames', 145),
	('6df295da-3bc8-4e75-b30e-3413001e3986', '110203b9-b619-4cba-9d21-edf159da0a27', '2026-03-25', 'Révision', 'Vidange complète et affûtage des lames', 145);


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."products" ("id", "name", "amm_number", "category", "unit", "stock", "threshold", "price_per_unit", "created_at") VALUES
	('71283246-0844-44de-8325-e2ccf8c79b28', 'Gazon Sport Haute Résistance', NULL, 'Semences', 'Kg', 200, 40, 12, '2026-05-25 09:13:15.788491+00'),
	('0e74992c-b6b0-437b-b6e0-19a6c6ebb8f0', 'Désherbant Systémique Pro', '2110045', 'Phyto', 'L', 25, 10, 45, '2026-05-25 09:13:15.788491+00'),
	('8b6c2727-7a06-4cdc-8812-ef5fdac04568', 'Fongicide Gazon 500', '2150089', 'Phyto', 'L', 12, 5, 65, '2026-05-25 09:13:15.788491+00'),
	('deae9a69-36b7-480f-b347-e1d18058ff38', 'Terreau de Plantation', NULL, 'Engrais', 'Sac', 80, 20, 8.5, '2026-05-25 09:13:15.788491+00'),
	('d26983d2-695d-4f9e-a01e-6d2d5475e698', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150.5, 50, 5.25, '2026-05-25 09:52:58.868399+00'),
	('21865314-c970-41e5-b3a4-a0583a75095e', 'Engrais Granulé Gazon (Sac 25kg)', NULL, 'Engrais', 'Sac', 45, 10, 32, '2026-05-25 09:52:58.868399+00'),
	('502c39d8-6180-4853-8917-841a60ca3f05', 'Gazon Sport Excellence', NULL, 'Semences', 'Kg', 120, 30, 14.5, '2026-05-25 09:52:58.868399+00'),
	('6113cd5e-acf7-4430-88ad-8c64933d1ad7', 'Herbistop Phyto (Bio-contrôle)', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-05-25 09:52:58.868399+00'),
	('0407ce01-4db8-4175-8ce6-8d9dfe5aa907', 'Fongicide Gazon 500', '2150089', 'Phyto', 'L', 8.5, 2, 75, '2026-05-25 09:52:58.868399+00'),
	('a3551bee-f326-429b-8963-6075475b5e19', 'Terreau de Plantation', NULL, 'Engrais', 'Sac', 200, 40, 9, '2026-05-25 09:52:58.868399+00'),
	('d64390d3-c3f8-46c8-ae10-9b5ad28bc8ca', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150.5, 50, 5.25, '2026-05-25 10:01:49.668026+00'),
	('c9a0b9a9-b478-472e-94f9-a3beba9a5e60', 'Engrais Granulé Gazon (Sac 25kg)', NULL, 'Engrais', 'Sac', 45, 10, 32, '2026-05-25 10:01:49.668026+00'),
	('1c3b668f-b120-4b2b-84a8-d91e7a791b0e', 'Gazon Sport Excellence', NULL, 'Semences', 'Kg', 120, 30, 14.5, '2026-05-25 10:01:49.668026+00'),
	('9b2afa60-301e-4575-8852-21fa1fc5cd1d', 'Herbistop Phyto (Bio-contrôle)', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-05-25 10:01:49.668026+00'),
	('b5a3c631-c025-4a45-a48c-530d37547255', 'Fongicide Gazon 500', '2150089', 'Phyto', 'L', 8.5, 2, 75, '2026-05-25 10:01:49.668026+00'),
	('52f9925d-cc4f-4673-b47d-61c37ab49868', 'Terreau de Plantation', NULL, 'Engrais', 'Sac', 200, 40, 9, '2026-05-25 10:01:49.668026+00'),
	('65394dc0-775a-48c9-8dad-02fe2da94526', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150.5, 50, 5.25, '2026-05-25 10:08:03.882834+00'),
	('da304f78-aea6-47fe-a2a6-2a38ff961bd1', 'Engrais Granulé Gazon (Sac 25kg)', NULL, 'Engrais', 'Sac', 45, 10, 32, '2026-05-25 10:08:03.882834+00'),
	('6a4fe0da-d17c-4924-8c61-370fb10a448b', 'Herbistop Phyto (Bio-contrôle)', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-05-25 10:08:03.882834+00'),
	('11111111-1111-1111-1111-111111111111', 'Engrais Gazon Pro', NULL, 'Engrais', 'Sac', 50, 10, 35, '2026-05-25 10:18:16.413052+00'),
	('22222222-2222-2222-2222-222222222222', 'Herbistop Phyto', NULL, 'Phyto', 'L', 20, 5, 45, '2026-05-25 10:18:16.413052+00'),
	('b0588a7b-7d0e-497d-934c-7bdb0d8f4938', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150, 50, 5.25, '2026-05-31 09:33:47.232649+00'),
	('2c319b47-112b-4354-9a7b-2cbc5d1e068e', 'Herbistop Phyto', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-05-31 09:33:47.232649+00'),
	('5e006bec-a96c-4153-89a6-f3f83f0b5ce3', 'Azote Liquide 20-10-10', NULL, 'Engrais', 'L', 150.5, 50, 5, '2026-05-25 09:13:15.788491+00'),
	('788e663e-92ec-49af-af85-51dcc220766c', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150, 50, 5.25, '2026-06-02 08:06:02.472342+00'),
	('b8a2e3cc-9df5-43d2-99b8-57bfb4bec96a', 'Herbistop Phyto', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-06-02 08:06:02.472342+00'),
	('bff0212f-e6f6-49bf-9ff5-5c7f1979abf8', 'Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150, 50, 5.25, '2026-06-02 10:58:50.160212+00'),
	('a5941a7c-8475-4785-9368-ca106676b416', 'Herbistop Phyto', '2110045', 'Phyto', 'L', 18, 5, 48, '2026-06-02 10:58:50.160212+00');


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: task_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."task_assignments" ("task_id", "user_id") VALUES
	('33333333-3333-3333-3333-333333333333', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('11111111-1111-1111-1111-111111111111', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('22222222-2222-2222-2222-222222222222', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('30e9125f-4284-41a0-9cb7-52c9acaf83b4', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('68b1208e-3553-4548-979a-47f9e1ca37c0', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('fc6c5079-0188-44d6-8768-d2e411002e98', '7aedfc8a-5c90-4e10-94df-628a05b3520d'),
	('a2222222-2222-2222-2222-222222222222', '6fdbc68e-8fd1-46cb-8463-e499255be938'),
	('a1111111-1111-1111-1111-111111111111', '6fdbc68e-8fd1-46cb-8463-e499255be938'),
	('44444444-4444-4444-4444-444444444444', '6fdbc68e-8fd1-46cb-8463-e499255be938'),
	('0bab371f-b565-41b2-8ea8-115d45766e70', '6fdbc68e-8fd1-46cb-8463-e499255be938');


--
-- Data for Name: task_equipment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."task_equipment" ("task_id", "equipment_id") VALUES
	('30e9125f-4284-41a0-9cb7-52c9acaf83b4', '00ff0834-a408-447c-9dc1-4c4a47e5eddd'),
	('11111111-1111-1111-1111-111111111111', '110203b9-b619-4cba-9d21-edf159da0a27'),
	('22222222-2222-2222-2222-222222222222', '21043bcf-bcbe-4c89-bfe5-c7b167e433ff'),
	('a2222222-2222-2222-2222-222222222222', '110203b9-b619-4cba-9d21-edf159da0a27'),
	('a2222222-2222-2222-2222-222222222222', 'add181a7-183d-457e-9101-bdd0193715bd'),
	('a1111111-1111-1111-1111-111111111111', '6d4c94a9-5af2-4ffc-8fa3-d448e2c33918'),
	('44444444-4444-4444-4444-444444444444', '7db62860-88d5-4ba1-8f88-6bfe7fcbec8d'),
	('44444444-4444-4444-4444-444444444444', '7e0e9d15-4314-4190-9c0e-1eb4d33e90f2'),
	('44444444-4444-4444-4444-444444444444', '6d4c94a9-5af2-4ffc-8fa3-d448e2c33918'),
	('0bab371f-b565-41b2-8ea8-115d45766e70', '5ed14688-d601-4c91-8a3a-4b68599af225');


--
-- Data for Name: task_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."task_products" ("id", "task_id", "product_id", "quantity", "lot_number", "dose_per_m2", "created_at") VALUES
	('5bd585ee-b794-4673-bbbf-82af266a26d5', '30e9125f-4284-41a0-9cb7-52c9acaf83b4', '5e006bec-a96c-4153-89a6-f3f83f0b5ce3', 10, 'LOT-2024-01', 0.5, '2026-05-25 09:13:15.788491+00'),
	('c062284e-5375-4c87-8f31-35ff2447929c', '11111111-1111-1111-1111-111111111111', 'd26983d2-695d-4f9e-a01e-6d2d5475e698', 2.5, 'LOT-AZ-2024', 0.2, '2026-05-25 09:52:58.868399+00'),
	('e223fe43-a819-49f6-bb8e-b80f291937da', '22222222-2222-2222-2222-222222222222', '6113cd5e-acf7-4430-88ad-8c64933d1ad7', 5, 'LOT-PHY-88', 0.5, '2026-05-25 09:52:58.868399+00'),
	('dce20fdf-50cf-4edd-898c-a332040d7fa7', '11111111-1111-1111-1111-111111111111', 'd26983d2-695d-4f9e-a01e-6d2d5475e698', 2.5, 'LOT-AZ-2024', 0.2, '2026-05-25 10:01:49.668026+00'),
	('7a20b72c-008c-4982-9010-d645f977535f', '22222222-2222-2222-2222-222222222222', '6113cd5e-acf7-4430-88ad-8c64933d1ad7', 5, 'LOT-PHY-88', 0.5, '2026-05-25 10:01:49.668026+00');


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."teams" ("id", "name", "color", "created_at", "is_archived", "overhead_labor_pct", "overhead_equip_pct", "overhead_mat_pct", "margin_pct", "tax_pct") VALUES
	('10de450a-a7f8-478c-b8fc-fc3c6794f63d', 'Équipe Sud', '#3b82f6', '2026-06-01 08:49:16.795898+00', false, 0, 0, 0, 20, 20),
	('a1b582bf-f42f-4016-a5a8-20407be50968', 'Coordination', '#f59e0b', '2026-06-01 08:49:16.795898+00', false, 0, 0, 0, 20, 20),
	('ffd2f45c-ebc3-42d7-80d1-8a08065a46f3', 'Équipe Nord', '#10b981', '2026-06-01 08:49:16.795898+00', false, 15, 15, 30, 20, 20);


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_roles" ("id", "user_id", "role") VALUES
	('25062e57-b9af-4254-9349-2ce51cf675e7', '7aedfc8a-5c90-4e10-94df-628a05b3520d', 'coordinator');


--
-- Data for Name: villes_fleuries_evaluations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

-- \unrestrict jMcLJc7jVXL4siTg5moJrLKC3br8mM0vidIu3Tn0lYGs8PPDNVe8brNDra9C3FL

RESET ALL;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'agent',
    'coordinator',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."equipment_status" AS ENUM (
    'OK',
    'Maintenance requise',
    'En panne'
);


ALTER TYPE "public"."equipment_status" OWNER TO "postgres";


CREATE TYPE "public"."product_category" AS ENUM (
    'Engrais',
    'Phyto',
    'Semences'
);


ALTER TYPE "public"."product_category" OWNER TO "postgres";


CREATE TYPE "public"."product_unit" AS ENUM (
    'L',
    'Kg',
    'Sac'
);


ALTER TYPE "public"."product_unit" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'normale',
    'haute',
    'urgente'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'planifie',
    'en_cours',
    'termine',
    'annule'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_company UUID := '11111111-1111-1111-1111-111111111111'; -- Remplacez par un ID de compagnie valide si nécessaire
  v_site    UUID := '22222222-2222-2222-2222-222222222222';    -- Remplacez par un ID de site valide si nécessaire
  v_loop    UUID;
BEGIN
  -- Profile
  INSERT INTO public.profiles (id, full_name, email, company_id, site_id,
    job_title, department, home_address, home_city, shift_type, shift_start, shift_end, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    v_company, v_site,
    'Opératrice CN', 'Production', '12 rue de la Paix', 'Tourcoing',
    'matin', '06:00', '14:00',
    TRUE -- Les nouveaux utilisateurs sont actifs par défaut
  ) ON CONFLICT (id) DO NOTHING;

  -- ... (le reste de votre fonction handle_new_user) ...

  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_purchase_order_reception"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Si le statut passe à 'recu', on incrémente le stock des produits
  IF (NEW.status = 'recu' AND (OLD.status IS DISTINCT FROM 'recu')) THEN
    UPDATE public.products p
    SET stock = p.stock + poi.quantity
    FROM public.purchase_order_items poi
    WHERE poi.order_id = NEW.id AND poi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_purchase_order_reception"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_demo_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Produits
  INSERT INTO public.products (name, amm_number, category, unit, stock, threshold, price_per_unit)
  VALUES 
  ('Azote Liquide Pro 20L', NULL, 'Engrais', 'L', 150, 50, 5.25),
  ('Herbistop Phyto', '2110045', 'Phyto', 'L', 18, 5, 48.00)
  ON CONFLICT DO NOTHING;

  -- 2. Matériel
  INSERT INTO public.equipment (name, type, hours_used, hours_for_maintenance, status, hourly_cost)
  VALUES 
  ('Kubota G23', 'Tondeuse', 242, 250, 'OK', 18.00),
  ('Stihl BR800', 'Souffleur', 48, 50, 'Maintenance requise', 4.50)
  ON CONFLICT DO NOTHING;

  -- 3. Tâches de test (IDs fixes pour faciliter les tests)
  INSERT INTO public.tasks (id, title, client, address, scheduled_at, duration, team, status, budget, labor_cost)
  VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'Tonte Résidence', 'Copropriété Les Pins', 'Lyon', NOW() - INTERVAL '3 days', 4, 'Équipe Nord', 'termine', 650, 280),
  ('a2222222-2222-2222-2222-222222222222', 'Aménagement Massifs', 'Mme. Durand', 'Bron', NOW(), 6, 'Équipe Nord', 'en_cours', 1500, NULL)
  ON CONFLICT DO NOTHING;

  -- 4. Lien automatique à l'utilisateur actuel
  INSERT INTO public.task_assignments (task_id, user_id)
  SELECT t.id, auth.uid()
  FROM public.tasks t
  ON CONFLICT DO NOTHING;

END;
$$;


ALTER FUNCTION "public"."seed_demo_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_last_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = new.last_sign_in_at
  WHERE id = new.id;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."sync_last_login"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."anomalies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "equipment_id" "uuid",
    "reported_by" "uuid",
    "description" "text",
    "resolved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "repair_notes" "text"
);


ALTER TABLE "public"."anomalies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."anomalies"."repair_notes" IS 'Notes techniques ajoutées lors de la résolution de l''anomalie.';



CREATE TABLE IF NOT EXISTS "public"."eco_wallets" (
    "user_id" "uuid" NOT NULL,
    "eco_tokens" integer DEFAULT 0 NOT NULL,
    "co2_saved_kg" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_trips" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."eco_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "assigned_to" "uuid",
    "hours_used" double precision DEFAULT 0,
    "hours_for_maintenance" double precision DEFAULT 100,
    "status" "public"."equipment_status" DEFAULT 'OK'::"public"."equipment_status",
    "last_maintenance" "date" DEFAULT CURRENT_DATE,
    "hourly_cost" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team" "text",
    "is_archived" boolean DEFAULT false,
    "internal_id" "text",
    "motorization_type" "text"
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


COMMENT ON COLUMN "public"."equipment"."motorization_type" IS 'Type de motorisation de l''engin (ex: Essence, 2T, Electrique, Diesel, etc.)';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'en_attente'::"text",
    "due_date" "date",
    "file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jarvis_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jarvis_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."jarvis_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE,
    "type" "text" NOT NULL,
    "description" "text",
    "cost" double precision DEFAULT 0
);


ALTER TABLE "public"."maintenance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "amm_number" "text",
    "category" "public"."product_category" NOT NULL,
    "unit" "public"."product_unit" NOT NULL,
    "stock" double precision DEFAULT 0,
    "threshold" double precision DEFAULT 0,
    "price_per_unit" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "team" "text",
    "hourly_rate" double precision DEFAULT 35,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "last_login_at" timestamp with time zone,
    "is_blocked" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "quantity" double precision NOT NULL,
    "unit_price" numeric NOT NULL
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid",
    "status" "text" DEFAULT 'brouillon'::"text",
    "total_amount" numeric DEFAULT 0,
    "expected_delivery" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_info" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignments" (
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_equipment" (
    "task_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "product_id" "uuid",
    "quantity" double precision NOT NULL,
    "lot_number" "text",
    "dose_per_m2" double precision,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "client" "text" NOT NULL,
    "address" "text" NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "scheduled_at" timestamp with time zone NOT NULL,
    "duration" double precision NOT NULL,
    "team" "text" NOT NULL,
    "status" "public"."task_status" DEFAULT 'planifie'::"public"."task_status",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "budget" double precision DEFAULT 0,
    "labor_cost" double precision,
    "notes" "text",
    "signature_url" "text",
    "photo_before_url" "text",
    "photo_after_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "priority" "text" DEFAULT 'normale'::"text",
    "requires_dry_weather" boolean DEFAULT false,
    "actual_weather" "text",
    "weather_alert_status" "text" DEFAULT 'ok'::"text",
    "project_number" "text",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['normale'::"text", 'haute'::"text", 'urgente'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#94a3b8'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_archived" boolean DEFAULT false,
    "overhead_labor_pct" numeric DEFAULT 0,
    "overhead_equip_pct" numeric DEFAULT 0,
    "overhead_mat_pct" numeric DEFAULT 0,
    "margin_pct" numeric DEFAULT 20,
    "tax_pct" numeric DEFAULT 20
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'agent'::"public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_equipment_alerts" AS
 SELECT "id",
    "name"
   FROM "public"."equipment"
  WHERE (("is_archived" = false) AND (("status" = 'En panne'::"public"."equipment_status") OR ("hours_used" >= "hours_for_maintenance")));


ALTER VIEW "public"."v_equipment_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."villes_fleuries_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commune_name" "text" NOT NULL,
    "visit_date" "date" NOT NULL,
    "evaluated_level" "text",
    "jury_decision" "text",
    "conclusions" "text",
    "recommendations" "text",
    "evaluation_criteria" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."villes_fleuries_evaluations" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anomalies"
    ADD CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eco_wallets"
    ADD CONSTRAINT "eco_wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jarvis_messages"
    ADD CONSTRAINT "jarvis_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("task_id", "user_id");



ALTER TABLE ONLY "public"."task_equipment"
    ADD CONSTRAINT "task_equipment_pkey" PRIMARY KEY ("task_id", "equipment_id");



ALTER TABLE ONLY "public"."task_products"
    ADD CONSTRAINT "task_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."villes_fleuries_evaluations"
    ADD CONSTRAINT "villes_fleuries_evaluations_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_tasks_project_number" ON "public"."tasks" USING "btree" ("project_number");



CREATE OR REPLACE TRIGGER "tr_on_purchase_order_received" AFTER UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_purchase_order_reception"();



ALTER TABLE ONLY "public"."anomalies"
    ADD CONSTRAINT "anomalies_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");



ALTER TABLE ONLY "public"."anomalies"
    ADD CONSTRAINT "anomalies_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."anomalies"
    ADD CONSTRAINT "anomalies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."eco_wallets"
    ADD CONSTRAINT "eco_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."jarvis_messages"
    ADD CONSTRAINT "jarvis_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_equipment"
    ADD CONSTRAINT "task_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_equipment"
    ADD CONSTRAINT "task_equipment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_products"
    ADD CONSTRAINT "task_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_products"
    ADD CONSTRAINT "task_products_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Accès total test" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins/Coordinators can manage all profiles" ON "public"."profiles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coordinator'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coordinator'::"public"."app_role"]))))));



CREATE POLICY "Admins/Coordinators can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coordinator'::"public"."app_role"]))))));



CREATE POLICY "Allow full access for admins and coordinators" ON "public"."villes_fleuries_evaluations" USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coordinator'::"public"."app_role"])))));



CREATE POLICY "Coordinateur voit toutes les anomalies" ON "public"."anomalies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable management for admins/coordinators" ON "public"."equipment" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'coordinator'::"public"."app_role"]))))));



CREATE POLICY "Enable read access for all users" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Gestion achats" ON "public"."suppliers" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Gestion commandes" ON "public"."purchase_orders" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Lecture anomalies coordinateur" ON "public"."anomalies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture globale des achats" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture globale des commandes" ON "public"."purchase_orders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture globale des factures" ON "public"."invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture totale" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Lecture totale matériel" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Lecture totale pour admin" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture totale pour tous" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Les coordinateurs gèrent l'équipement des tâches" ON "public"."task_equipment" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Les coordinateurs gèrent les assignations" ON "public"."task_assignments" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Les coordinateurs gèrent les produits des tâches" ON "public"."task_products" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Les rôles sont visibles par tous les connectés" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Les équipes sont visibles par tous les utilisateurs connectés" ON "public"."teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Profiles sont visibles par tous les connectés" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Seuls les coordinateurs peuvent gérer les équipes" ON "public"."teams" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coordinator'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Visibilité totale matériel" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Voir toutes les anomalies" ON "public"."anomalies" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."anomalies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eco_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jarvis_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own jarvis messages" ON "public"."jarvis_messages" TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."villes_fleuries_evaluations" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_purchase_order_reception"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_purchase_order_reception"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_purchase_order_reception"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_demo_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_demo_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_demo_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "service_role";



GRANT ALL ON TABLE "public"."anomalies" TO "anon";
GRANT ALL ON TABLE "public"."anomalies" TO "authenticated";
GRANT ALL ON TABLE "public"."anomalies" TO "service_role";



GRANT ALL ON TABLE "public"."eco_wallets" TO "anon";
GRANT ALL ON TABLE "public"."eco_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."eco_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."jarvis_messages" TO "anon";
GRANT ALL ON TABLE "public"."jarvis_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."jarvis_messages" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_logs" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."task_assignments" TO "anon";
GRANT ALL ON TABLE "public"."task_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."task_equipment" TO "anon";
GRANT ALL ON TABLE "public"."task_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."task_equipment" TO "service_role";



GRANT ALL ON TABLE "public"."task_products" TO "anon";
GRANT ALL ON TABLE "public"."task_products" TO "authenticated";
GRANT ALL ON TABLE "public"."task_products" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_equipment_alerts" TO "anon";
GRANT ALL ON TABLE "public"."v_equipment_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_equipment_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."villes_fleuries_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."villes_fleuries_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."villes_fleuries_evaluations" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








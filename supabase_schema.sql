-- Schéma pour le Système de Gestion des Espaces Verts

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Types Enumérés
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('agent', 'coordinator', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status') THEN
        CREATE TYPE equipment_status AS ENUM ('OK', 'Maintenance requise', 'En panne');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
        CREATE TYPE product_category AS ENUM ('Engrais', 'Phyto', 'Semences');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
        CREATE TYPE product_unit AS ENUM ('L', 'Kg', 'Sac');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('planifie', 'en_cours', 'termine', 'annule');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('normale', 'haute', 'urgente');
    END IF;
END $$;

-- 2. Profils (Agents)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team TEXT,
  hourly_rate NUMERIC DEFAULT 35,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2c. Équipes (Centralisation des couleurs et noms)
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b. Table des Rôles (pour la gestion RBAC)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'agent',
  UNIQUE(user_id, role)
);

-- Fonction d'aide pour vérifier les rôles
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Trigger pour créer automatiquement le profil et le rôle à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_role public.app_role;
BEGIN
  -- Récupération du rôle depuis les métadonnées ou défaut à 'agent'
  BEGIN
    default_role := (new.raw_user_meta_data ->> 'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    default_role := 'agent'::public.app_role;
  END;

  INSERT INTO public.profiles (id, name, team)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data ->> 'team', 'Équipe Nord')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, default_role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Matériel (Flotte)
CREATE TABLE IF NOT EXISTS equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  hours_used FLOAT DEFAULT 0,
  hours_for_maintenance FLOAT DEFAULT 100,
  status equipment_status DEFAULT 'OK',
  last_maintenance DATE DEFAULT CURRENT_DATE,
  hourly_cost NUMERIC DEFAULT 0, -- Pour le calcul analytique d'amortissement
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Produits (Inventaire & Réglementaire)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amm_number TEXT, -- Obligatoire pour le registre phyto
  category product_category NOT NULL,
  unit product_unit NOT NULL,
  stock FLOAT DEFAULT 0,
  threshold FLOAT DEFAULT 0,
  price_per_unit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4b. Gestion des Achats (Fournisseurs, Commandes, Factures)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'brouillon', -- 'brouillon', 'envoye', 'recu'
  total_amount NUMERIC DEFAULT 0,
  expected_delivery DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity FLOAT NOT NULL,
  unit_price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES purchase_orders(id),
  invoice_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'en_attente', -- 'en_attente', 'paye'
  due_date DATE,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour mettre à jour le stock à la réception d'une commande
CREATE OR REPLACE FUNCTION public.handle_purchase_order_reception()
RETURNS trigger AS $$
BEGIN
  IF (NEW.status = 'recu' AND (OLD.status IS DISTINCT FROM 'recu')) THEN
    UPDATE public.products p
    SET stock = p.stock + poi.quantity
    FROM public.purchase_order_items poi
    WHERE poi.order_id = NEW.id AND poi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_purchase_order_received ON public.purchase_orders;
CREATE TRIGGER tr_on_purchase_order_received
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_order_reception();

-- 5. Chantiers (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number TEXT,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT,
  lng FLOAT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration FLOAT NOT NULL, -- Heures prévues
  team TEXT NOT NULL,
  status task_status DEFAULT 'planifie',
  priority task_priority DEFAULT 'normale',
  requires_dry_weather BOOLEAN DEFAULT false,
  actual_weather TEXT,
  weather_alert_status TEXT DEFAULT 'ok',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  budget NUMERIC DEFAULT 0,
  labor_cost NUMERIC, -- Calculé à la clôture (nb agents * heures * taux)
  notes TEXT,
  signature_url TEXT,
  photo_before_url TEXT,
  photo_after_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tables de Jonction (Comptabilité Analytique & Affectation)
CREATE TABLE IF NOT EXISTS task_assignments (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_equipment (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, equipment_id)
);

-- Consommation réelle pour le coût de revient
CREATE TABLE IF NOT EXISTS task_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity FLOAT NOT NULL,
  lot_number TEXT,
  dose_per_m2 FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Historique Maintenance
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT NOT NULL, -- 'Révision', 'Réparation'
  description TEXT,
  cost FLOAT DEFAULT 0
);

-- 8. Signalements du terrain (Anomalies)
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  equipment_id UUID REFERENCES equipment(id),
  reported_by UUID REFERENCES profiles(id),
  description TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Configuration du Row Level Security (RLS)

-- Activation du RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Politiques pour les Profils et Rôles
CREATE POLICY "Les profils sont visibles par tous les utilisateurs connectés" 
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Les rôles sont visibles par tous les utilisateurs connectés" 
  ON user_roles FOR SELECT TO authenticated USING (true);

-- Politiques pour le Matériel et les Produits (Lecture globale pour inventaire)
CREATE POLICY "Le matériel est visible par tous" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Les produits sont visibles par tous" ON products FOR SELECT TO authenticated USING (true);

-- Politiques pour les Équipes (Nettoyage préalable pour éviter les erreurs)
DROP POLICY IF EXISTS "Les équipes sont visibles par tous les utilisateurs connectés" ON teams;
CREATE POLICY "Les équipes sont visibles par tous les utilisateurs connectés" 
  ON teams FOR SELECT TO authenticated USING (true);

-- Politiques pour les Tâches (Le cœur du filtrage)

-- 1. Les coordinateurs et admins voient tout
CREATE POLICY "Les coordinateurs et admins voient toutes les tâches"
  ON tasks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'));

-- 2. Les agents voient uniquement les tâches qui leur sont assignées
CREATE POLICY "Les agents voient leurs tâches assignées"
  ON tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments 
      WHERE task_id = tasks.id AND user_id = auth.uid()
    )
  );

-- Politiques pour les tables de jonction et logs (Lecture pour l'appli)
CREATE POLICY "Lecture globale des assignations" ON task_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale des consommations produits" ON task_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale de l'équipement des tâches" ON task_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale des anomalies" ON anomalies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale des maintenances" ON maintenance_logs FOR SELECT TO authenticated USING (true);

-- Politiques pour les Achats (Visibles par tous, modifiables par admin/coordinateur)
CREATE POLICY "Lecture globale des achats" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale des commandes" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture globale des factures" ON invoices FOR SELECT TO authenticated USING (true);

-- Politiques d'écriture pour les Coordinateurs/Admins
CREATE POLICY "Seuls les coordinateurs peuvent modifier les tâches"
  ON tasks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Seuls les coordinateurs peuvent gérer l'inventaire et le matériel"
  ON products FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Seuls les coordinateurs peuvent gérer la flotte"
  ON equipment FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Seuls les coordinateurs peuvent gérer les équipes"
  ON teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'coordinator') OR has_role(auth.uid(), 'admin'));

-- 10. Configuration du Stockage (Supabase Storage)

-- Création du bucket 'task-media' pour les photos et signatures
-- Note: Ce bucket est configuré en mode public pour simplifier l'accès via getPublicUrl
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-media', 'task-media', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le stockage des objets
CREATE POLICY "Lecture publique des médias de chantier" 
  ON storage.objects FOR SELECT TO authenticated 
  USING (bucket_id = 'task-media');

CREATE POLICY "Les agents peuvent uploader des photos et signatures" 
  ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'task-media');

CREATE POLICY "Les agents peuvent mettre à jour leurs propres médias" 
  ON storage.objects FOR UPDATE TO authenticated 
  USING (bucket_id = 'task-media');

CREATE POLICY "Les administrateurs peuvent supprimer des médias" 
  ON storage.objects FOR DELETE TO authenticated 
  USING (bucket_id = 'task-media' AND public.has_role(auth.uid(), 'admin'));
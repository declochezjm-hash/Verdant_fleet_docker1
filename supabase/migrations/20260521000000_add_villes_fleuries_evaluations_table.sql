-- Create table for Villes et Villages Fleuris evaluations
CREATE TABLE public.villes_fleuries_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    commune_name text NOT NULL,
    visit_date date NOT NULL,
    evaluated_level text, -- e.g., 'Niveau 1', 'Niveau 2', 'Niveau 3', 'Niveau 4'
    jury_decision text, -- 'Maintien', '1 Fleur', '2 Fleurs', '3 Fleurs', '4 Fleurs', 'Prix', 'Avertissement', 'Retrait'
    conclusions text,
    recommendations text,
    evaluation_criteria jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.villes_fleuries_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for RLS (assuming only admin/coordinator can manage these)
-- Allow full access for admins and coordinators
CREATE POLICY "Allow full access for admins and coordinators" ON public.villes_fleuries_evaluations
FOR ALL USING (
    auth.uid() IN (
        SELECT user_id FROM public.user_roles
        WHERE role IN ('admin', 'coordinator')
    )
);

-- Grant permissions to authenticated users (for simplicity, adjust as needed)
GRANT ALL ON TABLE public.villes_fleuries_evaluations TO authenticated;
GRANT ALL ON TABLE public.villes_fleuries_evaluations TO service_role;

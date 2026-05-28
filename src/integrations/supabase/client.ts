import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Support pour Vite (client) et Node/Bun (serveur)
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) return import.meta.env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return undefined;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
// On vérifie les deux noms possibles pour la clé anonyme
const SUPABASE_PUBLISHABLE_KEY = 
  getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_PUBLISHABLE_KEY');

export const isConfigured = !!(
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('votre-id') &&
  SUPABASE_PUBLISHABLE_KEY &&
  SUPABASE_PUBLISHABLE_KEY.length > 20
);

// Log de diagnostic pour vérifier les variables dans Docker
console.log("[Supabase Config] URL:", SUPABASE_URL, "Configured:", isConfigured);

if (!isConfigured) {
  console.error("❌ SUPABASE NOT CONFIGURED !");
  console.info("Vérifiez votre fichier .env à la racine du projet.");
  console.info("URL actuelle détectée :", SUPABASE_URL || "Non définie");
  console.info("Note : L'URL ne doit pas contenir 'votre-id'.");
}

export const supabase = createClient<Database>(
  isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isConfigured ? SUPABASE_PUBLISHABLE_KEY : 'placeholder',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

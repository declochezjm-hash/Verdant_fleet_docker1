import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Support pour Vite (client) et Node/Bun (serveur)
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) return (import.meta as any).env[key];
  return undefined;
};

const rawUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || '';
const SUPABASE_URL = String(rawUrl).replace(/['"]/g, '').trim();

// On vérifie les deux noms possibles pour la clé anonyme
const rawKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY') || '';
const SUPABASE_PUBLISHABLE_KEY = String(rawKey).replace(/['"]/g, '').trim();

export const isConfigured = !!(
  SUPABASE_URL.length > 0 &&
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('votre-id') &&
  SUPABASE_PUBLISHABLE_KEY.length > 0 &&
  SUPABASE_PUBLISHABLE_KEY.length > 20
);

// Log de diagnostic pour vérifier les variables dans Docker
if (!isConfigured) {
  if (typeof window !== 'undefined') {
    console.error("❌ SUPABASE NOT CONFIGURED ! Vérifiez votre fichier .env.");
  } else {
    // Côté serveur (Bun), on évite de polluer les logs de crash
    console.warn("[SSR] Supabase client initialized with placeholders");
  }
}

// Préparation des variables pour le client
const supabaseUrl = (isConfigured && SUPABASE_URL) ? SUPABASE_URL : 'https://placeholder-project.supabase.co';
const supabaseKey = isConfigured ? SUPABASE_PUBLISHABLE_KEY : 'placeholder-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Utilisation d'un mock de stockage côté serveur pour éviter l'erreur "window is not defined"
    storage: typeof window !== 'undefined' ? window.localStorage : {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

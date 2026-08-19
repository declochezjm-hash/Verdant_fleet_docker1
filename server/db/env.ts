const strip = (value: string | undefined) => String(value ?? "").replace(/['"]/g, "").trim();

export function getSupabaseServerEnv() {
  const url =
    strip(process.env.SUPABASE_URL) ||
    strip(process.env.VITE_SUPABASE_URL);

  const anonKey =
    strip(process.env.SUPABASE_ANON_KEY) ||
    strip(process.env.VITE_SUPABASE_ANON_KEY) ||
    strip(process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    strip(process.env.SUPABASE_PUBLISHABLE_KEY);

  if (!url || !anonKey) {
    throw new Error(
      "Variables Supabase manquantes : SUPABASE_URL et SUPABASE_ANON_KEY (ou équivalents VITE_*).",
    );
  }

  return { url, anonKey };
}

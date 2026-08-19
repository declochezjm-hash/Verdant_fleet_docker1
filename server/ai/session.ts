import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AiPrimaryRole, AiSessionContext } from "../db/readOnlyClient";
import { getSupabaseServerEnv } from "../db/env";
import { AiToolError } from "../db/errors";

type AppRole = Database["public"]["Enums"]["app_role"];

function resolvePrimaryRole(roles: AppRole[]): AiPrimaryRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("coordinator")) return "coordinator";
  if (roles.includes("agent")) return "agent";
  return null;
}

function parseClientScope(
  userMetadata: Record<string, unknown> | undefined,
  currentEntity?: Record<string, string | undefined>,
): string[] | null {
  const fromMeta = userMetadata?.client_scope;
  if (Array.isArray(fromMeta)) {
    return fromMeta.filter((v): v is string => typeof v === "string");
  }
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return [fromMeta.trim()];
  }
  const client = currentEntity?.client ?? currentEntity?.clientName;
  if (client) return [client];
  return null;
}

export async function buildSessionContext(
  accessToken: string,
  options?: {
    userRoleHint?: string;
    currentEntity?: Record<string, string | undefined>;
  },
): Promise<AiSessionContext> {
  const { url, anonKey } = getSupabaseServerEnv();

  const authClient = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    throw new AiToolError("UNAUTHORIZED", "Token invalide ou expiré.", 401);
  }

  const userId = userData.user.id;

  const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      authClient.from("profiles").select("team").eq("id", userId).maybeSingle(),
      authClient.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError) {
    throw new AiToolError("DB_QUERY_ERROR", profileError.message, 500);
  }
  if (rolesError) {
    throw new AiToolError("DB_QUERY_ERROR", rolesError.message, 500);
  }

  const roles = (roleRows ?? []).map((r) => r.role);
  let primaryRole = resolvePrimaryRole(roles);

  const hint = options?.userRoleHint;
  if (!primaryRole && (hint === "partner" || hint === "elu-partenaire")) {
    primaryRole = "partner";
  }

  if (!primaryRole) {
    throw new AiToolError("ROLE_UNKNOWN", "Aucun rôle applicatif associé à cet utilisateur.", 403);
  }

  const clientScope =
    primaryRole === "partner"
      ? parseClientScope(userData.user.user_metadata, options?.currentEntity)
      : null;

  return {
    userId,
    accessToken,
    primaryRole,
    teamName: profile?.team ?? null,
    clientScope,
    organizationId: null,
  };
}

export function extractBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AiToolError("UNAUTHORIZED", "En-tête Authorization Bearer requis.", 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new AiToolError("UNAUTHORIZED", "Token manquant.", 401);
  }
  return token;
}

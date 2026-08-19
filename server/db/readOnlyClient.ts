import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AiToolError } from "./errors";
import { getSupabaseServerEnv } from "./env";

export type AiPrimaryRole = "admin" | "coordinator" | "agent" | "partner";

/** Contexte session injecté par le middleware auth (Sprint 2). */
export interface AiSessionContext {
  userId: string;
  accessToken: string;
  primaryRole: AiPrimaryRole;
  teamName: string | null;
  clientScope: string[] | null;
  organizationId: string | null;
}

type VerduraSupabaseClient = SupabaseClient<Database>;

/**
 * Client Supabase read-only scoping JWT utilisateur.
 * NE JAMAIS utiliser SUPABASE_SERVICE_ROLE_KEY ici.
 */
export function createReadOnlyClient(ctx: AiSessionContext): VerduraSupabaseClient {
  const { url, anonKey } = getSupabaseServerEnv();

  const client = createClient<Database>(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return wrapReadOnlyProxy(client);
}

function wrapReadOnlyProxy(client: VerduraSupabaseClient): VerduraSupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const builder = target.from(table as keyof Database["public"]["Tables"] & string);
          return blockMutations(builder, table);
        };
      }
      if (prop === "rpc") {
        return (fn: string) => {
          throw new AiToolError(
            "RPC_FORBIDDEN",
            `RPC '${fn}' interdit en mode read-only IA.`,
            403,
          );
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as VerduraSupabaseClient;
}

const FORBIDDEN_MUTATIONS = new Set(["insert", "update", "upsert", "delete"]);

function blockMutations<TBuilder extends object>(builder: TBuilder, table: string): TBuilder {
  return new Proxy(builder, {
    get(target, method, receiver) {
      if (FORBIDDEN_MUTATIONS.has(String(method))) {
        return () => {
          throw new AiToolError(
            "WRITE_FORBIDDEN",
            `Mutation '${String(method)}' interdite sur '${table}' (read-only IA).`,
            403,
          );
        };
      }
      const value = Reflect.get(target, method, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { AiSessionContext } from "./readOnlyClient";
import { getSupabaseServerEnv } from "./env";

export interface JarvisMessageInput {
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
}

export async function insertJarvisMessage(
  ctx: AiSessionContext,
  message: JarvisMessageInput,
): Promise<void> {
  const { url, anonKey } = getSupabaseServerEnv();

  const client = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.from("jarvis_messages").insert({
    user_id: ctx.userId,
    role: message.role,
    content: message.content,
    metadata: (message.metadata ?? null) as Json,
  });

  if (error) {
    console.error("[Verdura] Échec persistance jarvis_messages :", error.message);
  }
}

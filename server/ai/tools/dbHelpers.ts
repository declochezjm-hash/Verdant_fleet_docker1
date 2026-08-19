import { AiToolError } from "../../db/errors";

export function assertNoDbError(
  error: { message: string } | null,
  context = "requête Supabase",
): void {
  if (error) {
    throw new AiToolError("DB_QUERY_ERROR", `${context} : ${error.message}`, 500);
  }
}

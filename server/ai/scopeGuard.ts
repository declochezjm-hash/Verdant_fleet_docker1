import type { AiSessionContext } from "../db/readOnlyClient";
import { AiToolError } from "../db/errors";

export interface ScopeFilters {
  teamName?: string;
  assignedUserId?: string;
  clientNames?: string[];
}

export function buildScopeFilters(ctx: AiSessionContext): ScopeFilters {
  switch (ctx.primaryRole) {
    case "agent":
      return {
        assignedUserId: ctx.userId,
        teamName: ctx.teamName ?? undefined,
      };
    case "coordinator":
      return { teamName: ctx.teamName ?? undefined };
    case "admin":
      return {};
    case "partner":
      if (!ctx.clientScope?.length) {
        throw new AiToolError(
          "SCOPE_MISSING",
          "client_scope requis pour le rôle partner.",
          403,
        );
      }
      return { clientNames: ctx.clientScope };
    default:
      throw new AiToolError("ROLE_UNKNOWN", "Rôle non reconnu.", 403);
  }
}

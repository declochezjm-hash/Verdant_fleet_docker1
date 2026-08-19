import { ZodError } from "zod";
import type { AiSessionContext } from "../../db/readOnlyClient";
import { AiToolError } from "../../db/errors";
import { isToolAllowed, type VerduraToolName } from "../toolPermissions";
import { getAnomaliesReport } from "./getAnomaliesReport";
import { getChantiersSummary } from "./getChantiersSummary";
import { getEquipmentAlerts } from "./getEquipmentAlerts";
import { getProductsConformity } from "./getProductsConformity";
import { getProfileGuide } from "./getProfileGuide";
import { TOOL_BADGES, VERDURA_AI_TOOL_DEFINITIONS } from "./schemas";
import { sanitizeToolResultForRole } from "./sanitize";

export { VERDURA_AI_TOOL_DEFINITIONS, TOOL_BADGES };

export interface ToolCallRecord {
  name: VerduraToolName;
  arguments: unknown;
  result: unknown;
  badge: string;
  durationMs: number;
}

type ToolHandler = (ctx: AiSessionContext, args: unknown) => Promise<unknown>;

const TOOL_HANDLERS: Record<VerduraToolName, ToolHandler> = {
  getChantiersSummary,
  getEquipmentAlerts,
  getAnomaliesReport,
  getProductsConformity,
  getProfileGuide,
};

export function getToolsForRole(role: AiSessionContext["primaryRole"]) {
  return VERDURA_AI_TOOL_DEFINITIONS.filter((tool) => {
    if (tool.type !== "function") return false;
    return isToolAllowed(tool.function.name, role);
  });
}

export async function dispatchTool(
  ctx: AiSessionContext,
  toolName: string,
  rawArgs: string,
): Promise<{ result: unknown; record: ToolCallRecord }> {
  if (!isToolAllowed(toolName, ctx.primaryRole)) {
    throw new AiToolError(
      "TOOL_NOT_ALLOWED",
      "Votre profil ne permet pas d'accéder à cette fonctionnalité.",
      403,
    );
  }

  const name = toolName as VerduraToolName;
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    throw new AiToolError("TOOL_UNKNOWN", `Outil inconnu : ${toolName}`, 400);
  }

  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    throw new AiToolError("VALIDATION_ERROR", "Arguments JSON invalides pour l'outil.", 400);
  }

  const started = Date.now();
  try {
    const result = await handler(ctx, args);
    const sanitized = sanitizeToolResultForRole(ctx.primaryRole, result);
    const record: ToolCallRecord = {
      name,
      arguments: args,
      result: sanitized,
      badge: TOOL_BADGES[name] ?? name,
      durationMs: Date.now() - started,
    };
    return { result: sanitized, record };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AiToolError(
        "VALIDATION_ERROR",
        `Paramètres de recherche invalides : ${error.message}`,
        400,
      );
    }
    throw error;
  }
}

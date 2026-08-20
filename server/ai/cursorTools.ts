import type { AiSessionContext } from "../db/readOnlyClient";
import { dispatchTool, getToolsForRole, type ToolCallRecord } from "./tools";
import { VERDURA_AI_TOOL_DEFINITIONS } from "./tools/schemas";

/** Sous-ensemble du type SDKCustomTool de @cursor/sdk (évite l'import au boot SSR). */
interface VerduraCursorCustomTool {
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export function buildVerduraCursorTools(
  ctx: AiSessionContext,
  toolsUsed: ToolCallRecord[],
): Record<string, VerduraCursorCustomTool> {
  const allowed = new Set(
    getToolsForRole(ctx.primaryRole).map((tool) => tool.function.name),
  );

  const customTools: Record<string, VerduraCursorCustomTool> = {};

  for (const definition of VERDURA_AI_TOOL_DEFINITIONS) {
    if (definition.type !== "function") continue;
    const { name, description, parameters } = definition.function;
    if (!allowed.has(name)) continue;

    customTools[name] = {
      description,
      inputSchema: parameters as VerduraCursorCustomTool["inputSchema"],
      async execute(args) {
        const { result, record } = await dispatchTool(ctx, name, JSON.stringify(args));
        toolsUsed.push(record);
        return JSON.stringify(result);
      },
    };
  }

  return customTools;
}

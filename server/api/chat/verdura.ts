import { insertJarvisMessage } from "../../db/auditClient";
import { AiToolError } from "../../db/errors";
import { buildSessionContext, extractBearerToken } from "../../ai/session";
import { type ToolCallRecord } from "../../ai/tools";
import { buildVerduraCursorTools } from "../../ai/cursorTools";
import { getCursorApiKey, getCursorModel } from "../../ai/cursorConfig";
import { buildVerduraSystemPrompt } from "../../ai/verduraTemplate";

export interface VerduraChatRequestBody {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userRole?: string;
  currentPath?: string;
  currentEntity?: Record<string, string | undefined>;
}

export interface VerduraChatResponseBody {
  message: string;
  toolsUsed: ToolCallRecord[];
  model: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Erreur inconnue.";
}

function isCursorSdkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error) {
    const name = String(error.name);
    if (name === "CursorAgentError" || name === "ConfigurationError") return true;
  }
  if ("operation" in error && typeof error.operation === "string") return true;
  const message = extractErrorMessage(error);
  return message.includes("ERR_DLOPEN_FAILED") || message.includes("tree-sitter");
}

function errorResponse(error: unknown): Response {
  if (error instanceof AiToolError) {
    return jsonResponse(error.toJSON(), error.httpStatus);
  }
  if (isCursorSdkError(error)) {
    const raw = extractErrorMessage(error);
    const message = raw.includes("ERR_DLOPEN_FAILED")
      ? "L'agent Cursor local ne peut pas s'exécuter dans cet environnement (binaires natifs). Relancez avec l'image Docker Debian ou utilisez npm run dev sur Windows."
      : raw || "Erreur agent Cursor.";
    console.error("[Verdura Chat] Cursor:", error);
    return jsonResponse(
      {
        code: "CURSOR_ERROR",
        message,
        httpStatus: 502,
      },
      502,
    );
  }
  console.error("[Verdura Chat]", error);
  return jsonResponse(
    { code: "INTERNAL_ERROR", message: "Erreur interne du serveur.", httpStatus: 500 },
    500,
  );
}

function buildCursorPrompt(
  systemPrompt: string,
  messages: VerduraChatRequestBody["messages"],
): string {
  const history = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return `${systemPrompt}\n\n---\n\n${history}`;
}

export async function handleVerduraChatRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED", message: "POST uniquement." }, 405);
  }

  try {
    const accessToken = extractBearerToken(request);
    const body = (await request.json()) as VerduraChatRequestBody;

    if (!body.messages?.length) {
      throw new AiToolError("VALIDATION_ERROR", "Le champ messages est requis.", 400);
    }

    const ctx = await buildSessionContext(accessToken, {
      userRoleHint: body.userRole,
      currentEntity: body.currentEntity,
    });

    const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      throw new AiToolError("VALIDATION_ERROR", "Au moins un message utilisateur est requis.", 400);
    }

    await insertJarvisMessage(ctx, {
      role: "user",
      content: lastUserMessage.content,
      metadata: {
        currentPath: body.currentPath,
        currentEntity: body.currentEntity,
        userRole: body.userRole,
      },
    });

    const apiKey = getCursorApiKey();
    const model = getCursorModel();
    const toolsUsed: ToolCallRecord[] = [];
    const customTools = buildVerduraCursorTools(ctx, toolsUsed);
    const toolNames = Object.keys(customTools);
    const systemPrompt = await buildVerduraSystemPrompt(ctx, {
      currentPath: body.currentPath,
      currentEntity: body.currentEntity,
      availableTools: toolNames,
    });
    const prompt = buildCursorPrompt(systemPrompt, body.messages);

    const { Agent } = await import("@cursor/sdk");
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: model },
      local: {
        cwd: process.cwd(),
        customTools: customTools as Record<string, import("@cursor/sdk").SDKCustomTool>,
        settingSources: [],
      },
      // Uniquement les custom tools Verdura (exposés via MCP) — lecture BDD Supabase.
      tools: ["mcp"],
    });

    if (result.status === "error") {
      throw new AiToolError(
        "CURSOR_ERROR",
        result.error?.message ?? "L'agent Cursor n'a pas pu terminer la réponse.",
        502,
      );
    }

    const assistantContent =
      result.result?.trim() ||
      "Je n'ai pas pu finaliser la réponse. Veuillez reformuler votre question.";

    await insertJarvisMessage(ctx, {
      role: "assistant",
      content: assistantContent,
      metadata: {
        model,
        toolsUsed: toolsUsed.map((t) => ({
          name: t.name,
          badge: t.badge,
          durationMs: t.durationMs,
          arguments: t.arguments,
        })),
        currentPath: body.currentPath,
      },
    });

    const response: VerduraChatResponseBody = {
      message: assistantContent,
      toolsUsed,
      model,
    };

    return jsonResponse(response);
  } catch (error) {
    return errorResponse(error);
  }
}

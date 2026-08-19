import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { insertJarvisMessage } from "../../db/auditClient";
import { AiToolError } from "../../db/errors";
import { buildSessionContext, extractBearerToken } from "../../ai/session";
import { dispatchTool, getToolsForRole, type ToolCallRecord } from "../../ai/tools";
import { buildVerduraSystemPrompt } from "../../ai/verduraTemplate";

const MAX_TOOL_ITERATIONS = 5;

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

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiToolError(
      "OPENAI_CONFIG",
      "OPENAI_API_KEY manquante côté serveur.",
      500,
    );
  }
  return new OpenAI({ apiKey });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AiToolError) {
    return jsonResponse(error.toJSON(), error.httpStatus);
  }
  console.error("[Verdura Chat]", error);
  return jsonResponse(
    { code: "INTERNAL_ERROR", message: "Erreur interne du serveur.", httpStatus: 500 },
    500,
  );
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

    const systemPrompt = await buildVerduraSystemPrompt(ctx, {
      currentPath: body.currentPath,
      currentEntity: body.currentEntity,
    });

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const tools = getToolsForRole(ctx.primaryRole);

    const conversation: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...body.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const toolsUsed: ToolCallRecord[] = [];
    let assistantContent = "";

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const completion = await openai.chat.completions.create({
        model,
        messages: conversation,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
      });

      const choice = completion.choices[0];
      if (!choice?.message) {
        throw new AiToolError("OPENAI_ERROR", "Réponse OpenAI vide.", 502);
      }

      const assistantMessage = choice.message;
      conversation.push(assistantMessage);

      if (!assistantMessage.tool_calls?.length) {
        assistantContent = assistantMessage.content ?? "";
        break;
      }

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;

        const fnCall = toolCall;
        const { result, record } = await dispatchTool(
          ctx,
          fnCall.function.name,
          fnCall.function.arguments,
        );
        toolsUsed.push(record);

        const toolMessage: ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: fnCall.id,
          content: JSON.stringify(result),
        };
        conversation.push(toolMessage);
      }
    }

    if (!assistantContent) {
      assistantContent =
        "Je n'ai pas pu finaliser la réponse. Veuillez reformuler votre question.";
    }

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

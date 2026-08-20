import { AiToolError } from "../db/errors";

export function getCursorApiKey(): string {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new AiToolError(
      "CURSOR_CONFIG",
      "CURSOR_API_KEY manquante côté serveur.",
      500,
    );
  }
  return apiKey;
}

export function getCursorModel(): string {
  return process.env.CURSOR_MODEL?.trim() || "composer-2.5";
}

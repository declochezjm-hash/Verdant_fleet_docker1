import type { VerduraChatMessage } from "@/hooks/useVerduraChat";

export interface VerduraChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageIds: string[];
  messages: VerduraChatMessage[];
}

const SESSION_GAP_MS = 30 * 60 * 1000;

export function getMessageSessionId(message: VerduraChatMessage): string | null {
  const sessionId = message.metadata?.sessionId;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}

function sessionTitle(messages: VerduraChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const source = firstUser?.content ?? messages[0]?.content ?? "Conversation";
  const trimmed = source.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
}

function sessionPreview(messages: VerduraChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "assistant" || m.role === "user");
  const text = last?.content?.trim() ?? "";
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function buildSession(id: string, cluster: VerduraChatMessage[]): VerduraChatSession {
  const sorted = [...cluster].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const updatedAt = sorted[sorted.length - 1]!.createdAt;
  return {
    id,
    title: sessionTitle(sorted),
    preview: sessionPreview(sorted),
    updatedAt,
    messageIds: sorted.map((m) => m.id),
    messages: sorted,
  };
}

function groupLegacyMessagesByTimeGap(messages: VerduraChatMessage[]): VerduraChatSession[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const clusters: VerduraChatMessage[][] = [];
  let current: VerduraChatMessage[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!.createdAt).getTime();
    const curr = new Date(sorted[i]!.createdAt).getTime();
    if (curr - prev > SESSION_GAP_MS) {
      clusters.push(current);
      current = [];
    }
    current.push(sorted[i]!);
  }
  clusters.push(current);

  return clusters.map((cluster) => buildSession(cluster[0]!.id, cluster));
}

export function groupMessagesIntoSessions(messages: VerduraChatMessage[]): VerduraChatSession[] {
  if (messages.length === 0) return [];

  const withSessionId: VerduraChatMessage[] = [];
  const withoutSessionId: VerduraChatMessage[] = [];

  for (const message of messages) {
    if (getMessageSessionId(message)) {
      withSessionId.push(message);
    } else {
      withoutSessionId.push(message);
    }
  }

  const sessionMap = new Map<string, VerduraChatMessage[]>();
  for (const message of withSessionId) {
    const sessionId = getMessageSessionId(message)!;
    const bucket = sessionMap.get(sessionId) ?? [];
    bucket.push(message);
    sessionMap.set(sessionId, bucket);
  }

  const explicitSessions = [...sessionMap.entries()].map(([sessionId, cluster]) =>
    buildSession(sessionId, cluster),
  );
  const legacySessions = groupLegacyMessagesByTimeGap(withoutSessionId);

  return [...explicitSessions, ...legacySessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

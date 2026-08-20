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

export function groupMessagesIntoSessions(messages: VerduraChatMessage[]): VerduraChatSession[] {
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

  return clusters
    .map((cluster) => {
      const updatedAt = cluster[cluster.length - 1]!.createdAt;
      return {
        id: cluster[0]!.id,
        title: sessionTitle(cluster),
        preview: sessionPreview(cluster),
        updatedAt,
        messageIds: cluster.map((m) => m.id),
        messages: cluster,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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

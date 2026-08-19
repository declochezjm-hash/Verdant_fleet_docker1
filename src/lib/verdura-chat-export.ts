import type { VerduraChatMessage } from "@/hooks/useVerduraChat";

export function buildConversationMarkdown(
  messages: VerduraChatMessage[],
  contextLabel: string,
  primaryRole: string | null,
  exportedAt: Date = new Date(),
): string {
  const date = exportedAt.toISOString().slice(0, 10);
  const lines = [
    `# Conversation Verdura — ${date}`,
    "",
    `> Contexte : ${contextLabel}`,
    `> Rôle : ${primaryRole ?? "non défini"}`,
    `> Exporté le : ${exportedAt.toISOString()}`,
    "",
  ];

  for (const msg of messages) {
    const label =
      msg.role === "user" ? "Utilisateur" : msg.role === "assistant" ? "Verdura" : "Système";
    const badge = msg.metadata?.toolBadge ? ` [${msg.metadata.toolBadge}]` : "";
    lines.push(`## ${label}${badge}`, "", msg.content, "");
  }

  return lines.join("\n");
}

export function downloadMarkdownFile(content: string, exportedAt: Date = new Date()): void {
  const date = exportedAt.toISOString().slice(0, 10);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `verdura-chat-${date}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

import * as React from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOptionalVerduraPageContext } from "@/lib/verdura-page-context";
import { buildConversationMarkdown, downloadMarkdownFile } from "@/lib/verdura-chat-export";

export type VerduraMessageRole = "user" | "assistant" | "system";

export interface VerduraChatMessage {
  id: string;
  role: VerduraMessageRole;
  content: string;
  createdAt: string;
  metadata?: {
    tool?: string;
    toolBadge?: string;
    context?: Record<string, unknown>;
    errorCode?: string;
  };
}

export type VerduraPageKind =
  | "dashboard"
  | "planning"
  | "carte"
  | "coordinator"
  | "materiel"
  | "stocks"
  | "anomalies"
  | "analytics"
  | "settings"
  | "unknown";

export interface VerduraChatContext {
  pathname: string;
  pageKind: VerduraPageKind;
  taskId?: string;
  projectNumber?: string;
  equipmentId?: string;
  internalId?: string;
  productId?: string;
  ammNumber?: string;
  userId: string;
  primaryRole: "admin" | "coordinator" | "agent" | "partner" | null;
  teamName: string | null;
  contextLabel: string;
}

export interface UseVerduraChatReturn {
  messages: VerduraChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  isDrawerOpen: boolean;
  context: VerduraChatContext;
  contextLabel: string;
  historySynced: boolean;
  setDrawerOpen: (open: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
  sendProfileGuideRequest: () => Promise<void>;
  exportMarkdown: () => void;
  clearHistory: () => Promise<void>;
  reloadHistory: () => Promise<void>;
}

const PROFILE_GUIDE_PROMPT =
  "Affiche-moi le guide complet et la fiche métier pour mon rôle Verdura.";

const VerduraChatContextReact = React.createContext<UseVerduraChatReturn | null>(null);

function mapPathToPageKind(pathname: string): VerduraPageKind {
  const path = pathname.replace(/\/$/, "") || "/";
  const map: Record<string, VerduraPageKind> = {
    "/": "dashboard",
    "/planning": "planning",
    "/carte": "carte",
    "/coordinator": "coordinator",
    "/materiel": "materiel",
    "/stocks": "stocks",
    "/anomalies": "anomalies",
    "/analytics": "analytics",
    "/settings": "settings",
  };
  return map[path] ?? "unknown";
}

function parseSearchParams(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function buildContextLabel(input: {
  pageKind: VerduraPageKind;
  pathname: string;
  projectNumber?: string;
  internalId?: string;
  ammNumber?: string;
  entityType?: "task" | "equipment" | "product";
  label?: string;
}): string {
  if (input.label) {
    if (input.entityType === "task") return `Chantier ${input.label}`;
    if (input.entityType === "equipment") return `Engin ${input.label}`;
    if (input.entityType === "product") {
      return input.ammNumber ? `AMM ${input.ammNumber}` : `Produit ${input.label}`;
    }
    return input.label;
  }
  if (input.projectNumber) return `Chantier ${input.projectNumber}`;
  if (input.internalId) return `Engin ${input.internalId}`;
  if (input.ammNumber) return `AMM ${input.ammNumber}`;
  if (input.pageKind !== "dashboard" && input.pageKind !== "unknown") {
    return `/${input.pageKind}`;
  }
  if (input.pathname && input.pathname !== "/") return input.pathname;
  return "Tableau de bord";
}

function resolvePageContext(
  pathname: string,
  searchStr: string,
  pageCtx: ReturnType<typeof useOptionalVerduraPageContext>,
  auth: ReturnType<typeof useAuth>,
): VerduraChatContext {
  const search = parseSearchParams(searchStr);
  const pageKind = mapPathToPageKind(pathname);

  const taskId = search.taskId ?? pageCtx?.taskId;
  const equipmentId = search.equipmentId ?? pageCtx?.equipmentId;
  const productId = search.productId ?? pageCtx?.productId;
  const projectNumber = pageCtx?.projectNumber ?? search.projectNumber;
  const internalId = pageCtx?.internalId ?? search.internalId;
  const ammNumber = pageCtx?.ammNumber ?? search.ammNumber;

  const contextLabel = buildContextLabel({
    pageKind,
    pathname,
    projectNumber,
    internalId,
    ammNumber,
    entityType: pageCtx?.type,
    label: pageCtx?.label,
  });

  return {
    pathname,
    pageKind,
    taskId,
    projectNumber,
    equipmentId,
    internalId,
    productId,
    ammNumber,
    userId: auth.user?.id ?? "",
    primaryRole: auth.primaryRole,
    teamName: auth.profile?.team ?? null,
    contextLabel,
  };
}

function toApiEntity(
  ctx: VerduraChatContext,
  pageCtx: ReturnType<typeof useOptionalVerduraPageContext>,
): Record<string, string | undefined> {
  return {
    type: pageCtx?.type,
    id: pageCtx?.id,
    label: pageCtx?.label,
    taskId: ctx.taskId,
    projectNumber: ctx.projectNumber,
    equipmentId: ctx.equipmentId,
    internalId: ctx.internalId,
    productId: ctx.productId,
    ammNumber: ctx.ammNumber,
    teamName: ctx.teamName ?? undefined,
  };
}

function mapDbMessage(row: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: unknown;
}): VerduraChatMessage {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as VerduraChatMessage["metadata"])
      : undefined;

  return {
    id: row.id,
    role: row.role as VerduraMessageRole,
    content: row.content,
    createdAt: row.created_at,
    metadata,
  };
}

function useVerduraChatInternal(): UseVerduraChatReturn {
  const auth = useAuth();
  const location = useLocation();
  const pageCtx = useOptionalVerduraPageContext();

  const [messages, setMessages] = React.useState<VerduraChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDrawerOpen, setDrawerOpen] = React.useState(false);
  const [historySynced, setHistorySynced] = React.useState(true);

  const context = React.useMemo(
    () => resolvePageContext(location.pathname, location.searchStr, pageCtx, auth),
    [location.pathname, location.searchStr, pageCtx, auth],
  );

  const reloadHistory = React.useCallback(async () => {
    if (!auth.user?.id) return;

    const { data, error: dbError } = await supabase
      .from("jarvis_messages")
      .select("id, role, content, metadata, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (dbError) {
      setHistorySynced(false);
      return;
    }

    setHistorySynced(true);
    setMessages((data ?? []).map(mapDbMessage));
  }, [auth.user?.id]);

  React.useEffect(() => {
    if (isDrawerOpen && auth.user) {
      void reloadHistory();
    }
  }, [isDrawerOpen, auth.user, reloadHistory]);

  const sendMessage = React.useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      if (!auth.session?.access_token || !auth.user) {
        setError("Session expirée. Veuillez vous reconnecter.");
        return;
      }

      setError(null);
      setIsLoading(true);
      setIsStreaming(true);

      const userMessage: VerduraChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        metadata: { context: toApiEntity(context, pageCtx) as Record<string, unknown> },
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      try {
        const response = await fetch("/api/chat/verdura", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.session.access_token}`,
          },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            userRole: auth.primaryRole ?? undefined,
            currentPath: context.pathname,
            currentEntity: toApiEntity(context, pageCtx),
          }),
        });

        const rawBody = await response.text();
        let payload: {
          message?: string;
          code?: string;
          toolsUsed?: Array<{ name: string; badge: string }>;
        };

        try {
          payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          throw new Error(
            response.ok
              ? "Réponse serveur invalide (JSON attendu)."
              : `L'API chat n'est pas disponible (${response.status}). Rechargez la page ou redémarrez le serveur.`,
          );
        }

        if (!response.ok) {
          throw new Error(payload.message ?? "Erreur lors de l'appel à Verdura.");
        }

        const toolBadge = payload.toolsUsed?.[0]?.badge;
        const assistantMessage: VerduraChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.message ?? "",
          createdAt: new Date().toISOString(),
          metadata: {
            tool: payload.toolsUsed?.[0]?.name,
            toolBadge,
            context: toApiEntity(context, pageCtx) as Record<string, unknown>,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        void reloadHistory();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur réseau.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [auth.session, auth.user, auth.primaryRole, context, isLoading, messages, reloadHistory],
  );

  const sendProfileGuideRequest = React.useCallback(async () => {
    await sendMessage(PROFILE_GUIDE_PROMPT);
  }, [sendMessage]);

  const exportMarkdown = React.useCallback(() => {
    const markdown = buildConversationMarkdown(
      messages,
      context.contextLabel,
      context.primaryRole,
    );
    downloadMarkdownFile(markdown);
  }, [messages, context]);

  const clearHistory = React.useCallback(async () => {
    if (!auth.user?.id) return;

    setIsLoading(true);
    setError(null);

    const { error: dbError } = await supabase
      .from("jarvis_messages")
      .delete()
      .eq("user_id", auth.user.id);

    if (dbError) {
      setError("Impossible d'effacer l'historique.");
      setIsLoading(false);
      return;
    }

    setMessages([]);
    setIsLoading(false);
    setHistorySynced(true);
  }, [auth.user?.id]);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    isDrawerOpen,
    context,
    contextLabel: context.contextLabel,
    historySynced,
    setDrawerOpen,
    sendMessage,
    sendProfileGuideRequest,
    exportMarkdown,
    clearHistory,
    reloadHistory,
  };
}

export function VerduraChatProvider({ children }: { children: React.ReactNode }) {
  const value = useVerduraChatInternal();
  return React.createElement(VerduraChatContextReact.Provider, { value }, children);
}

export function useVerduraChat(): UseVerduraChatReturn {
  const ctx = React.useContext(VerduraChatContextReact);
  if (!ctx) {
    throw new Error("useVerduraChat must be used within VerduraChatProvider");
  }
  return ctx;
}

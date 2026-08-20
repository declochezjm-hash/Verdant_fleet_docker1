import * as React from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useOptionalVerduraPageContext } from "@/lib/verdura-page-context";
import { buildConversationMarkdown, downloadMarkdownFile } from "@/lib/verdura-chat-export";
import {
  groupMessagesIntoSessions,
  type VerduraChatSession,
} from "@/lib/verdura-chat-sessions";

export type VerduraMessageRole = "user" | "assistant" | "system";

export interface VerduraChatMessage {
  id: string;
  role: VerduraMessageRole;
  content: string;
  createdAt: string;
  metadata?: {
    sessionId?: string;
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
  isFullScreen: boolean;
  isSidebarOpen: boolean;
  recentSessions: VerduraChatSession[];
  currentSessionId: string;
  context: VerduraChatContext;
  contextLabel: string;
  historySynced: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleFullScreen: () => void;
  toggleSidebar: () => void;
  startNewChat: () => void;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteCurrentChat: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendProfileGuideRequest: () => Promise<void>;
  exportMarkdown: () => void;
  clearHistory: () => Promise<void>;
  reloadHistory: () => Promise<void>;
}

const PROFILE_GUIDE_PROMPT =
  "Affiche-moi le guide complet et la fiche métier pour mon rôle Verdura.";

const VerduraChatContextReact = React.createContext<UseVerduraChatReturn | null>(null);

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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
  const [isFullScreen, setIsFullScreen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [recentSessions, setRecentSessions] = React.useState<VerduraChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = React.useState(createSessionId);
  const [historySynced, setHistorySynced] = React.useState(true);

  const toggleFullScreen = React.useCallback(() => {
    setIsFullScreen((prev) => {
      const next = !prev;
      if (next) setIsSidebarOpen(true);
      return next;
    });
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const startNewChat = React.useCallback(() => {
    setCurrentSessionId(createSessionId());
    setMessages([]);
    setError(null);
  }, []);

  const loadRecentSessions = React.useCallback(async () => {
    if (!auth.user?.id) return [];

    const { data, error: dbError } = await supabase
      .from("jarvis_messages")
      .select("id, role, content, metadata, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (dbError) {
      setHistorySynced(false);
      return [];
    }

    setHistorySynced(true);
    const mapped = (data ?? []).map(mapDbMessage);
    const sessions = groupMessagesIntoSessions(mapped);
    setRecentSessions(sessions);
    return sessions;
  }, [auth.user?.id]);

  const selectSession = React.useCallback(
    (sessionId: string) => {
      const session = recentSessions.find((s) => s.id === sessionId);
      if (!session) return;
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      setError(null);
    },
    [recentSessions],
  );

  const deleteSession = React.useCallback(
    async (sessionId: string) => {
      if (!auth.user?.id) return;

      const session = recentSessions.find((s) => s.id === sessionId);
      if (!session?.messageIds.length) return;

      setIsLoading(true);
      setError(null);

      const { error: dbError } = await supabase
        .from("jarvis_messages")
        .delete()
        .in("id", session.messageIds);

      if (dbError) {
        setError("Impossible de supprimer cette conversation.");
        setIsLoading(false);
        return;
      }

      const sessions = await loadRecentSessions();
      if (currentSessionId === sessionId) {
        const next = sessions[0];
        if (next) {
          setCurrentSessionId(next.id);
          setMessages(next.messages);
        } else {
          startNewChat();
        }
      }

      setIsLoading(false);
    },
    [auth.user?.id, recentSessions, currentSessionId, loadRecentSessions, startNewChat],
  );

  const deleteCurrentChat = React.useCallback(async () => {
    if (!auth.user?.id) return;

    const session = recentSessions.find((s) => s.id === currentSessionId);
    let messageIds = session?.messageIds ?? [];

    if (messageIds.length === 0 && messages.length > 0) {
      messageIds = messages.map((m) => m.id);
    }

    if (messageIds.length === 0) {
      startNewChat();
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: dbError } = await supabase
      .from("jarvis_messages")
      .delete()
      .in("id", messageIds);

    if (dbError) {
      setError("Impossible de supprimer cette conversation.");
      setIsLoading(false);
      return;
    }

    setRecentSessions((prev) => prev.filter((s) => s.id !== currentSessionId));
    await loadRecentSessions();
    startNewChat();
    setIsLoading(false);
  }, [
    auth.user?.id,
    currentSessionId,
    recentSessions,
    messages,
    startNewChat,
    loadRecentSessions,
  ]);

  const context = React.useMemo(
    () => resolvePageContext(location.pathname, location.searchStr, pageCtx, auth),
    [location.pathname, location.searchStr, pageCtx, auth],
  );

  const reloadHistory = React.useCallback(async () => {
    const sessions = await loadRecentSessions();
    const session = sessions.find((s) => s.id === currentSessionId);
    if (session) setMessages(session.messages);
  }, [loadRecentSessions, currentSessionId]);

  React.useEffect(() => {
    if (isDrawerOpen && auth.user) {
      void loadRecentSessions();
      void reloadHistory();
    }
  }, [isDrawerOpen, auth.user, loadRecentSessions, reloadHistory]);

  React.useEffect(() => {
    if (!isFullScreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullScreen]);

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

      const isFirstMessage = messages.length === 0;
      const sessionId = currentSessionId;

      const userMessage: VerduraChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        metadata: {
          sessionId,
          context: toApiEntity(context, pageCtx) as Record<string, unknown>,
        },
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      if (isFirstMessage) {
        const title = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
        const preview = trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
        setRecentSessions((prev) => [
          {
            id: sessionId,
            title,
            preview,
            updatedAt: userMessage.createdAt,
            messageIds: [userMessage.id],
            messages: [userMessage],
          },
          ...prev.filter((s) => s.id !== sessionId),
        ]);
      }

      try {
        const response = await fetch("/api/chat/verdura", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.session.access_token}`,
          },
          body: JSON.stringify({
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            sessionId,
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
            sessionId,
            tool: payload.toolsUsed?.[0]?.name,
            toolBadge,
            context: toApiEntity(context, pageCtx) as Record<string, unknown>,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        await loadRecentSessions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur réseau.";
        setError(message);
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [auth.session, auth.user, auth.primaryRole, context, currentSessionId, isLoading, messages, loadRecentSessions, pageCtx],
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
    setRecentSessions([]);
    setCurrentSessionId(createSessionId());
    setIsLoading(false);
    setHistorySynced(true);
  }, [auth.user?.id]);

  const handleSetDrawerOpen = React.useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) setIsFullScreen(false);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    isDrawerOpen,
    isFullScreen,
    isSidebarOpen,
    recentSessions,
    currentSessionId,
    context,
    contextLabel: context.contextLabel,
    historySynced,
    setDrawerOpen: handleSetDrawerOpen,
    toggleFullScreen,
    toggleSidebar,
    startNewChat,
    selectSession,
    deleteSession,
    deleteCurrentChat,
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

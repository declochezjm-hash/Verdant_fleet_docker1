import * as React from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Copy,
  Download,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Minus,
  Plus,
  Send,
  SidebarClose,
  SidebarOpen,
  Trash2,
  X,
} from "lucide-react";
import { useVerduraChat, type VerduraChatMessage } from "@/hooks/useVerduraChat";
import { VerduraMarkdown } from "@/components/chat/VerduraMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatSessionDate } from "@/lib/verdura-chat-sessions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_REPLIES = [
  { emoji: "🌳", text: "Quels chantiers sont en retard ?" },
  { emoji: "🚨", text: "Affiche le matériel en alerte / panne" },
  { emoji: "⚠️", text: "Résumé des anomalies critiques" },
  { emoji: "🌿", text: "Consulter le référentiel Espaces Verts" },
  { emoji: "🚜", text: "Consulter la bible Entretien Matériel" },
] as const;

interface VerduraChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MessageBubble({ message }: { message: VerduraChatMessage }) {
  const [hovered, setHovered] = React.useState(false);
  const isUser = message.role === "user";
  const isGuide =
    message.content.includes("guide complet") || message.metadata?.tool === "getProfileGuide";

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Réponse copiée");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn("group relative max-w-[92%]", isUser ? "items-end" : "items-start")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {!isUser && message.metadata?.toolBadge && (
          <Badge
            variant="outline"
            className="mb-1 border-emerald-200 bg-emerald-50/60 text-[10px] font-medium text-emerald-800"
          >
            {message.metadata.toolBadge}
          </Badge>
        )}

        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm shadow-sm",
            isUser
              ? "bg-slate-900 text-white"
              : "border border-emerald-100/60 bg-emerald-50/40 text-slate-800",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-snug">{message.content}</p>
          ) : (
            <VerduraMarkdown content={message.content} variant={isGuide ? "guide" : "compact"} />
          )}
        </div>

        {!isUser && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute -right-1 top-6 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100",
              hovered && "opacity-100",
            )}
            onClick={() => void copyContent()}
            aria-label="Copier la réponse"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ChatInput({
  onSend,
  disabled,
  wide = false,
}: {
  onSend: (content: string) => Promise<void>;
  disabled: boolean;
  wide?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || disabled) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await onSend(content);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className={cn(
        "border-t border-emerald-100/60 bg-white/80 p-3",
        wide && "mx-auto w-full max-w-3xl bg-transparent px-4 pb-6 pt-2",
      )}
    >
      <div className={cn("flex items-end gap-2", wide && "rounded-2xl border border-slate-200 bg-white p-2 shadow-sm")}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          placeholder="Posez votre question à Verdura…"
          disabled={disabled}
          rows={1}
          className={cn(
            "min-h-[44px] max-h-40 resize-none border-slate-200 bg-white focus-visible:ring-emerald-500",
            wide && "border-0 shadow-none focus-visible:ring-0",
          )}
        />
        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="shrink-0 bg-emerald-700 hover:bg-emerald-800"
          aria-label="Envoyer"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function WindowControls({
  isFullScreen,
  onToggleFullScreen,
  onMinimize,
  onClose,
  className,
}: {
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onMinimize: () => void;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-500 hover:text-slate-800"
        onClick={onToggleFullScreen}
        aria-label={isFullScreen ? "Quitter le plein écran" : "Plein écran"}
      >
        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-500 hover:text-slate-800"
        onClick={onMinimize}
        aria-label="Réduire"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-500 hover:text-slate-800"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function WelcomeEmptyState({
  onQuickReply,
  centered = false,
}: {
  onQuickReply: (text: string) => void;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 text-center",
        centered ? "mx-auto max-w-2xl flex-1 items-center justify-center px-6 py-12" : "py-8",
      )}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-slate-800">Comment puis-je vous aider ?</h3>
        <p className="text-sm text-slate-500">
          Bonjour ! Je suis Verdura, votre copilote terrain pour les espaces verts.
        </p>
      </div>
      <div
        className={cn(
          "grid w-full gap-2",
          centered ? "max-w-xl sm:grid-cols-1" : "flex flex-col",
        )}
      >
        {QUICK_REPLIES.map((item) => (
          <button
            key={item.text}
            type="button"
            onClick={() => onQuickReply(item.text)}
            className={cn(
              "rounded-xl border border-emerald-100 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50",
              centered && "hover:shadow-md",
            )}
          >
            <span className="mr-2">{item.emoji}</span>
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeleteConversationDialog({
  onConfirm,
  disabled,
  dark = false,
  compact = false,
}: {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  dark?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
      toast.success("Conversation supprimée");
    } catch {
      toast.error("Suppression impossible");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "icon" : "sm"}
          className={cn(
            compact
              ? "h-7 w-7 text-slate-400 hover:text-red-400"
              : "h-7 text-xs",
            !compact &&
              (dark
                ? "border-slate-700 bg-slate-800 text-red-300 hover:bg-slate-700 hover:text-red-200"
                : "border-red-200 text-red-700 hover:bg-red-50"),
            dark && compact && "hover:bg-slate-700",
          )}
          disabled={disabled || pending}
          aria-label="Supprimer la conversation"
        >
          <Trash2 className={cn(compact ? "h-3.5 w-3.5" : "mr-1.5 h-3.5 w-3.5")} />
          {!compact && "Supprimer"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Tout l&apos;historique de cet échange sera définitivement
            effacé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="mt-2 border-0 bg-transparent shadow-none hover:bg-slate-100 sm:mt-0">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => void handleConfirm(event)}
            disabled={pending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SessionSidebar({
  chat,
}: {
  chat: ReturnType<typeof useVerduraChat>;
}) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out",
        chat.isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-r-0",
      )}
    >
      <div className="space-y-3 p-3">
        <Button
          type="button"
          className="w-full rounded-lg bg-slate-800 p-2.5 text-white hover:bg-slate-700"
          onClick={chat.startNewChat}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouveau chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Récents
        </p>
        <div className="space-y-1 pb-3">
          {chat.recentSessions.length === 0 && (
            <p className="px-2 py-4 text-xs text-slate-500">Aucune conversation récente.</p>
          )}
          {chat.recentSessions.map((session) => {
            const isActive =
              chat.activeSessionId === session.id ||
              (!chat.activeSessionId && chat.messages.length > 0 && session.id === chat.recentSessions[0]?.id);
            return (
              <div
                key={session.id}
                className={cn(
                  "group relative rounded-lg transition-colors",
                  isActive ? "bg-slate-800" : "hover:bg-slate-800/70",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                  onClick={() => chat.selectSession(session.id)}
                >
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{session.title}</p>
                    <p className="truncate text-xs text-slate-400">{session.preview}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {formatSessionDate(session.updatedAt)}
                    </p>
                  </div>
                </button>
                <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <DeleteConversationDialog
                    compact
                    dark
                    disabled={chat.isLoading}
                    onConfirm={() => chat.deleteSession(session.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ChatHeader({
  chat,
  onMinimize,
  onClose,
  dark = false,
}: {
  chat: ReturnType<typeof useVerduraChat>;
  onMinimize: () => void;
  onClose: () => void;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b px-4 py-3",
        dark ? "border-slate-800 bg-slate-900" : "border-emerald-100/60 bg-white",
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {chat.isFullScreen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white"
              onClick={chat.toggleSidebar}
              aria-label={chat.isSidebarOpen ? "Masquer la sidebar" : "Afficher la sidebar"}
            >
              {chat.isSidebarOpen ? (
                <SidebarClose className="h-4 w-4" />
              ) : (
                <SidebarOpen className="h-4 w-4" />
              )}
            </Button>
          )}
          <h2 className={cn("text-base font-semibold", dark ? "text-white" : "text-slate-900")}>
            Verdura Copilote
          </h2>
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-normal",
              dark
                ? "border-slate-700 bg-slate-800 text-slate-300"
                : "border-slate-200 bg-slate-50 text-slate-600",
            )}
          >
            📍 {chat.contextLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-7 text-xs",
              dark
                ? "border-slate-700 bg-slate-800 text-emerald-300 hover:bg-slate-700"
                : "border-emerald-200 text-emerald-800 hover:bg-emerald-50",
            )}
            onClick={() => void chat.sendProfileGuideRequest()}
            disabled={chat.isLoading}
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Guides & Fiches Métier
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-7 text-xs", dark && "border-slate-700 bg-slate-800 text-slate-200")}
            onClick={chat.exportMarkdown}
            disabled={chat.messages.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export .md
          </Button>
          <DeleteConversationDialog
            dark={dark}
            disabled={chat.isLoading || chat.messages.length === 0}
            onConfirm={() => chat.deleteCurrentChat()}
          />
        </div>
      </div>

      <WindowControls
        isFullScreen={chat.isFullScreen}
        onToggleFullScreen={chat.toggleFullScreen}
        onMinimize={onMinimize}
        onClose={onClose}
        className={dark ? "text-slate-300" : undefined}
      />
    </div>
  );
}

function ChatBody({
  chat,
  bottomRef,
  fullscreen = false,
}: {
  chat: ReturnType<typeof useVerduraChat>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  fullscreen?: boolean;
}) {
  const isEmpty = chat.messages.length === 0 && !chat.isLoading;

  return (
    <>
      {!chat.historySynced && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Historique non synchronisé — les messages restent en mémoire locale.
        </div>
      )}

      {chat.error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {chat.error}
        </div>
      )}

      <ScrollArea className={cn("flex-1", fullscreen ? "bg-slate-50" : "px-3 py-3")}>
        <div
          className={cn(
            "flex min-h-full flex-col gap-3",
            fullscreen && "mx-auto w-full max-w-3xl px-4 py-6",
            isEmpty && fullscreen && "justify-center",
          )}
        >
          {isEmpty && (
            <WelcomeEmptyState
              centered={fullscreen}
              onQuickReply={(text) => void chat.sendMessage(text)}
            />
          )}

          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {chat.isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verdura analyse votre demande…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput
        onSend={chat.sendMessage}
        disabled={chat.isLoading || chat.isStreaming}
        wide={fullscreen}
      />
    </>
  );
}

function FullscreenChat({ chat, onClose }: { chat: ReturnType<typeof useVerduraChat>; onClose: () => void }) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length, chat.isLoading]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-slate-950 transition-all duration-300 ease-in-out">
      <SessionSidebar chat={chat} />
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <ChatHeader chat={chat} onMinimize={onClose} onClose={onClose} dark />
        <ChatBody chat={chat} bottomRef={bottomRef} fullscreen />
      </div>
    </div>,
    document.body,
  );
}

export function VerduraChatDrawer({ open, onOpenChange }: VerduraChatDrawerProps) {
  const chat = useVerduraChat();
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, chat.messages.length, chat.isLoading]);

  const handleClose = () => onOpenChange(false);
  const handleMinimize = () => onOpenChange(false);

  if (chat.isFullScreen && open) {
    return <FullscreenChat chat={chat} onClose={handleClose} />;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full max-w-full flex-col gap-0 p-0 transition-all duration-300 ease-in-out sm:max-w-[450px]",
          "[&>button]:hidden",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Verdura Copilote</SheetTitle>
          <SheetDescription>Assistant IA Verdura pour la gestion des espaces verts</SheetDescription>
        </SheetHeader>

        <ChatHeader chat={chat} onMinimize={handleMinimize} onClose={handleClose} />
        <ChatBody chat={chat} bottomRef={bottomRef} />
      </SheetContent>
    </Sheet>
  );
}

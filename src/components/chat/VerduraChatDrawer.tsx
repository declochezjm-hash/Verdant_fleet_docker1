import * as React from "react";
import { BookOpen, Copy, Download, Loader2, Send, Trash2 } from "lucide-react";
import { useVerduraChat, type VerduraChatMessage } from "@/hooks/useVerduraChat";
import { VerduraMarkdown } from "@/components/chat/VerduraMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_REPLIES = [
  { emoji: "🌳", text: "Quels chantiers sont en retard ?" },
  { emoji: "🚨", text: "Affiche le matériel en alerte / panne" },
  { emoji: "⚠️", text: "Résumé des anomalies critiques" },
] as const;

interface VerduraChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MessageBubble({ message }: { message: VerduraChatMessage }) {
  const [hovered, setHovered] = React.useState(false);
  const isUser = message.role === "user";
  const isGuide = message.content.includes("guide complet") || message.metadata?.tool === "getProfileGuide";

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
}: {
  onSend: (content: string) => Promise<void>;
  disabled: boolean;
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
    <div className="flex items-end gap-2 border-t border-emerald-100/60 bg-white/80 p-3">
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
        className="min-h-[44px] max-h-40 resize-none border-slate-200 bg-white focus-visible:ring-emerald-500"
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px] xl:max-w-[480px]"
      >
        <SheetHeader className="space-y-2 border-b border-emerald-100/60 px-4 py-3 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-slate-900">
              Verdura Copilote
            </SheetTitle>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-[11px] font-normal text-slate-600"
            >
              📍 {chat.contextLabel}
            </Badge>
          </div>
          <SheetDescription className="sr-only">
            Assistant IA Verdura pour la gestion des espaces verts
          </SheetDescription>

          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-emerald-200 text-xs text-emerald-800 hover:bg-emerald-50"
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
              className="h-7 text-xs"
              onClick={chat.exportMarkdown}
              disabled={chat.messages.length === 0}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export .md
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-500"
              onClick={() => void chat.clearHistory()}
              disabled={chat.messages.length === 0 || chat.isLoading}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Effacer
            </Button>
          </div>
        </SheetHeader>

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

        <ScrollArea className="flex-1 px-3 py-3">
          <div className="flex min-h-full flex-col gap-3">
            {chat.messages.length === 0 && !chat.isLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                <p className="text-sm text-slate-500">
                  Bonjour ! Je suis Verdura, votre copilote terrain.
                </p>
                <div className="flex w-full flex-col gap-2">
                  {QUICK_REPLIES.map((item) => (
                    <Button
                      key={item.text}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal border-emerald-100 bg-emerald-50/30 px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50"
                      onClick={() => void chat.sendMessage(item.text)}
                    >
                      <span className="mr-2">{item.emoji}</span>
                      {item.text}
                    </Button>
                  ))}
                </div>
              </div>
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

        <ChatInput onSend={chat.sendMessage} disabled={chat.isLoading || chat.isStreaming} />
      </SheetContent>
    </Sheet>
  );
}

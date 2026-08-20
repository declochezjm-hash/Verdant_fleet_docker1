import * as React from "react";
import { Sparkles } from "lucide-react";
import { useVerduraChat } from "@/hooks/useVerduraChat";
import { VerduraChatDrawer } from "@/components/chat/VerduraChatDrawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bouton discret pour ouvrir le copilote — à placer à gauche du nom utilisateur. */
export function VerduraChatButton({ className }: { className?: string }) {
  const chat = useVerduraChat();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Ouvrir Verdura Copilote"
      title="Verdura Copilote (Ctrl+Shift+V)"
      className={cn(
        "relative h-8 w-8 shrink-0 text-muted-foreground/70 hover:bg-emerald-50 hover:text-emerald-700",
        chat.isDrawerOpen && "bg-emerald-50/80 text-emerald-700",
        className,
      )}
      onClick={() => chat.setDrawerOpen(!chat.isDrawerOpen)}
    >
      <Sparkles className="h-4 w-4 stroke-[1.5]" />
      {!chat.isDrawerOpen && chat.messages.length > 0 && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      )}
    </Button>
  );
}

/** Tiroir + raccourci clavier (sans bouton flottant). */
export function VerduraChatHost() {
  const chat = useVerduraChat();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        chat.setDrawerOpen(!chat.isDrawerOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chat]);

  return <VerduraChatDrawer open={chat.isDrawerOpen} onOpenChange={chat.setDrawerOpen} />;
}

/** @deprecated Utiliser VerduraChatButton + VerduraChatHost séparément. */
export function VerduraFloatingButton() {
  return (
    <>
      <VerduraChatHost />
    </>
  );
}

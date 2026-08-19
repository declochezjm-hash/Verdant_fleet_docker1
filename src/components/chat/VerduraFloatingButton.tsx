import * as React from "react";
import { MessageCircle } from "lucide-react";
import { useVerduraChat } from "@/hooks/useVerduraChat";
import { VerduraChatDrawer } from "@/components/chat/VerduraChatDrawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VerduraFloatingButton() {
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

  return (
    <>
      <Button
        type="button"
        size="icon"
        aria-label="Ouvrir Verdura Copilote"
        className={cn(
          "fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg",
          "bg-emerald-700 text-white hover:bg-emerald-800",
          chat.isDrawerOpen && "scale-95 opacity-90",
        )}
        onClick={() => chat.setDrawerOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
        {!chat.isDrawerOpen && chat.messages.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-slate-900">
            {Math.min(chat.messages.length, 9)}
          </span>
        )}
      </Button>

      <VerduraChatDrawer open={chat.isDrawerOpen} onOpenChange={chat.setDrawerOpen} />
    </>
  );
}

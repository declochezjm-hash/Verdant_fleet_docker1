import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export function SignaturePad({ value, onChange }: { value?: string; onChange: (dataUrl: string | undefined) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#16a34a";
    if (value) {
      const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault(); drawing.current = true; const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return; const ctx = ref.current!.getContext("2d")!;
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return; drawing.current = false;
    onChange(ref.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setEmpty(true); onChange(undefined);
  };

  return (
    <div>
      <div className="relative rounded-md border bg-white">
        <canvas
          ref={ref} width={600} height={180}
          className="h-40 w-full touch-none rounded-md"
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        />
        {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Signez ici avec le doigt</div>}
      </div>
      <Button variant="ghost" size="sm" onClick={clear} className="mt-1"><Eraser className="mr-1 h-3.5 w-3.5" /> Effacer</Button>
    </div>
  );
}

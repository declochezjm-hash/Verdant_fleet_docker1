import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

export interface VerduraMarkdownProps {
  content: string;
  variant?: "compact" | "guide";
  className?: string;
}

function buildComponents(variant: "compact" | "guide"): Components {
  const compact = variant === "compact";

  return {
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-800 text-white">{children}</thead>,
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold">{children}</th>
    ),
    tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
    tr: ({ children }) => (
      <tr className="even:bg-slate-50/50 odd:bg-white">{children}</tr>
    ),
    td: ({ children }) => <td className="px-3 py-1.5 text-slate-700">{children}</td>,
    ul: ({ children }) => (
      <ul
        className={cn(
          "list-disc pl-4 [&>li]:m-0 [&>li]:p-0",
          compact ? "my-1 space-y-0.5" : "my-3 space-y-1",
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "list-decimal pl-4 [&>li]:m-0 [&>li]:p-0",
          compact ? "my-1 space-y-0.5" : "my-3 space-y-1",
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children, className }) => (
      <li className={cn("text-sm leading-snug", className)}>{children}</li>
    ),
    input: ({ checked }) => (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-2 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
      />
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-4 border-emerald-500 bg-emerald-50/30 p-2 text-sm text-slate-700 not-italic">
        {children}
      </blockquote>
    ),
    code: ({ className, children }) => {
      const isBlock = Boolean(className);
      if (isBlock) {
        return (
          <code className="block overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs text-slate-800">
            {children}
          </code>
        );
      }
      return (
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
    p: ({ children }) => (
      <p className={cn("text-sm text-slate-800", compact ? "my-1 leading-snug" : "my-2 leading-relaxed")}>
        {children}
      </p>
    ),
    h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold text-slate-900">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-1.5 mt-2.5 text-sm font-semibold text-slate-900">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-medium text-slate-900">{children}</h3>,
    a: ({ href, children }) => (
      <a href={href} className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  };
}

export function VerduraMarkdown({ content, variant = "compact", className }: VerduraMarkdownProps) {
  return (
    <div className={cn("verdura-markdown max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(variant)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

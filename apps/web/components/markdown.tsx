import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

// Message bodies and BRIAN text/fallbacks are Markdown (Android renders them natively).
// Raw HTML is never rendered and react-markdown strips unsafe URLs; remote images are
// shown as their alt text so a message cannot make the client fetch arbitrary URLs.
// remark-breaks keeps chat semantics: a single newline is a line break.
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  h1: ({ children }) => <p className="mb-2 text-base font-semibold text-slate-100">{children}</p>,
  h2: ({ children }) => <p className="mb-2 text-base font-semibold text-slate-100">{children}</p>,
  h3: ({ children }) => <p className="mb-1 font-semibold text-slate-100">{children}</p>,
  h4: ({ children }) => <p className="mb-1 font-semibold text-slate-100">{children}</p>,
  blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-[#334155] pl-3 text-slate-400">{children}</blockquote>,
  code: ({ className, children }) => (
    <code className={cn("rounded bg-[#1A2338] px-1 py-0.5 font-mono text-[0.85em]", className)}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-[#1A2338] p-3 text-xs [&>code]:bg-transparent [&>code]:p-0">{children}</pre>
  ),
  hr: () => <hr className="my-3 border-[#334155]" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto"><table className="text-left text-sm">{children}</table></div>
  ),
  th: ({ children }) => <th className="border-b border-[#334155] px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-[#1E293B] px-2 py-1">{children}</td>,
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
};

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words text-sm text-slate-300", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Bot, Database, Loader2, RotateCcw, User } from "lucide-react";

type Step = { name: string; args: Record<string, unknown> };
type Message = { role: "user" | "assistant"; text: string; steps?: Step[]; error?: boolean; quota?: boolean };

const EXAMPLES = [
  "Where can I buy a 2 bedroom apartment under AED 1.5M near a metro?",
  "Compare JVC, Business Bay and Dubai Marina",
  "What would a 1 bedroom, 750 sq ft off-plan flat in Business Bay cost?",
  "Are Dubai prices really falling?",
  "Which projects sold below the price the model expects?",
  "Cheapest areas for a 4 bedroom villa",
];

const TOOL_LABELS: Record<string, string> = {
  search_areas: "Searched areas",
  get_area: "Looked up area",
  compare_areas: "Compared areas",
  estimate_price: "Ran price model",
  market_overview: "Read market overview",
  value_projects: "Checked value projects",
};

function describeArgs(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

// Tiny, safe markdown: **bold**, [label](/internal-path), bullet and numbered lists. No raw HTML.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else out.push(<Link key={m.index} href={m[3]} className="font-semibold text-violet underline decoration-violet/30 underline-offset-2 hover:decoration-violet">{m[2]}</Link>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`my-2 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(heading ? <p key={blocks.length} className="mt-2 font-bold">{inline(heading[1])}</p> : <p key={blocks.length} className="my-1.5">{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Message[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages([...next, { role: "assistant", text: data.error ?? "Something went wrong. Please try again.", error: true, quota: data.code === "daily_quota" }]);
        return;
      }
      setMessages([...next, { role: "assistant", text: data.answer, steps: data.steps }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="card flex min-h-[440px] flex-col overflow-hidden">
      <div className="flex-1 space-y-5 p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-4">
            <p className="font-display text-lg font-bold">Try asking</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => send(e)} className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm font-semibold text-ink-soft transition hover:-translate-y-0.5 hover:border-violet/40 hover:text-ink">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-ink text-white" : "bg-[linear-gradient(135deg,#2b59ff,#7a4dff_55%,#d63c8f)] text-white"}`} aria-hidden="true">
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === "user" ? "bg-ink text-white" : m.error ? "bg-[#fff1f1] text-[#9b1c1c]" : "bg-white text-ink ring-1 ring-line"}`}>
              <span className="sr-only">{m.role === "user" ? "You:" : "Assistant:"}</span>
              {m.role === "user" || m.error ? <p className="whitespace-pre-wrap">{m.text}</p> : <Markdown text={m.text} />}
              {m.quota && (
                <p className="mt-2 flex flex-wrap gap-2">
                  <Link href="/areas" className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-line hover:ring-violet/40">Browse areas</Link>
                  <Link href="/estimate" className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-line hover:ring-violet/40">Price estimator</Link>
                </p>
              )}
              {m.steps && m.steps.length > 0 && (
                <details className="mt-3 border-t border-line pt-2 text-xs text-ink-muted">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold hover:text-ink">
                    <Database className="h-3.5 w-3.5" aria-hidden="true" /> Data used: {m.steps.length} {m.steps.length === 1 ? "lookup" : "lookups"}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {m.steps.map((s, j) => (
                      <li key={j}>
                        <span className="font-semibold text-ink-soft">{TOOL_LABELS[s.name] ?? s.name}</span>
                        {Object.keys(s.args).length > 0 && <Fragment> · {describeArgs(s.args)}</Fragment>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef1f9]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></span>
            Checking the DLD data…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-line bg-white/70 p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="question" className="sr-only">Your question</label>
          <textarea
            id="question"
            ref={inputRef}
            rows={1}
            maxLength={600}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about prices, areas or projects in Dubai…"
            className="max-h-40 min-h-[48px] w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-[15px] focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15"
          />
          {messages.length > 0 && (
            <button type="button" onClick={() => setMessages([])} disabled={busy} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-ink-soft ring-1 ring-line hover:text-ink disabled:opacity-50" aria-label="Start a new conversation">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button type="submit" disabled={busy || !input.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white transition hover:bg-violet disabled:opacity-40" aria-label="Send">
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 px-1 text-xs text-ink-muted">Answers come from 2026 DLD sales, worked out by tools; the AI only explains them. Not financial advice.</p>
      </form>
    </div>
  );
}

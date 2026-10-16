import { NextResponse } from "next/server";
import { AgentError, ask, type ChatTurn } from "@/lib/assistant/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 600;
const MAX_TURNS = 8;
// Best-effort limit per visitor so one person can't use up the free Gemini quota.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > PER_WINDOW;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "The assistant is not configured yet." }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many questions in a short time. Please wait a few minutes." }, { status: 429 });

  let history: ChatTurn[];
  try {
    const body = await req.json();
    history = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: ChatTurn) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string" && m.text.trim())
      .slice(-MAX_TURNS)
      .map((m: ChatTurn) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS * 3) }));
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const last = history.at(-1);
  if (!last || last.role !== "user") return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  if (last.text.length > MAX_CHARS) return NextResponse.json({ error: `Please keep questions under ${MAX_CHARS} characters.` }, { status: 400 });
  while (history[0]?.role !== "user") history.shift(); // Gemini expects the conversation to start with the user

  try {
    const result = await ask(history, key);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof AgentError ? e.status : 500;
    console.error("assistant error", (e as Error).message.slice(0, 300));
    if (e instanceof AgentError && e.dailyQuotaUsed)
      return NextResponse.json({ error: "Today’s free AI quota is used up. It resets every day at about 11:00 Dubai time (12:30 India time). Meanwhile, the area pages and the price estimator show the same data.", code: "daily_quota" }, { status: 429 });
    if (status === 429 || status === 503) return NextResponse.json({ error: "The free AI quota is busy right now. Please try again in a minute." }, { status: 429 });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}

import { meta } from "../data";
import { DECLARATIONS, runTool } from "./tools";

/*
 * A small tool-calling agent on the Gemini REST API (no SDK). The model decides which tools to
 * call; the tools compute the numbers from DLD data; the model then writes the answer from the
 * tool results. Each question may take a few rounds (for example search, then estimate).
 */

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ToolStep = { name: string; args: Record<string, unknown> };
type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thoughtSignature?: string };
type Content = { role: "user" | "model"; parts: Part[] };

const MAX_ROUNDS = 5;
const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Models are tried in order: when one is missing, overloaded or out of free quota, the next is used.
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const FALL_THROUGH = new Set([404, 429, 500, 503]);
let modelCache: { at: number; list: string[] } | null = null;

/** Flash models this key can use, newest first (asks Google; cached for an hour per server instance). */
async function modelList(key: string): Promise<string[]> {
  const wanted = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  if (modelCache && Date.now() - modelCache.at < 3600_000) return [...new Set([...wanted, ...modelCache.list])];
  let list = FALLBACK_MODELS;
  try {
    const res = await fetch(`${API}?pageSize=200`, { headers: { "x-goog-api-key": key } });
    if (res.ok) {
      const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
      const rank = (n: string) => version(n) * 100 - (n.includes("preview") || n.includes("exp") ? 20 : 0) - (n.includes("lite") ? 10 : 0);
      const found = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((n) => /^gemini-[\d.]+-flash/.test(n) && !/(image|tts|audio|live|thinking|8b)/.test(n) && !/-\d{3}$/.test(n))
        .sort((a, b) => rank(b) - rank(a));
      if (found.length) list = found.slice(0, 5);
    }
  } catch {
    // keep the fallback list
  }
  modelCache = { at: Date.now(), list };
  console.log("gemini models:", list.join(", "));
  return [...new Set([...wanted, ...list])];
}

const SYSTEM = `You are the AI assistant of Dubai Property Intelligence, a website built on official Dubai Land Department (DLD) residential sales from ${meta.period.from} to ${meta.period.to} (apartments and villas/townhouses).

Rules:
- Use the tools for every fact. Every number you give must come from a tool result in this conversation. Never guess or use outside knowledge for prices.
- If the data cannot answer (rents and rental yields, Abu Dhabi or other emirates, mortgages, visas, service charges, a specific unit's details, future prices), say so plainly in one sentence and offer what the data can show instead.
- Do not tell people to buy, sell or invest. If asked "should I buy", give the relevant facts and add that this is not financial advice.
- Prices are medians of past sales. Say "median" or "typical", not "price of".
- "Nearest metro" is a field DLD records, not a measured walking distance; say so when you use it.
- Keep answers short: at most about 150 words, with bullet points for lists. Write money like AED 1.25M or AED 850K, and price per sq ft like AED 1,650/sq ft.
- Link areas with markdown using the page paths from the tools, like [Business Bay](/areas/business-bay). Only use paths that appear in tool results.
- Reply in the user's language (English, Hindi or Hinglish, Arabic).
- Politely decline questions that are not about Dubai property.`;

export class AgentError extends Error {
  constructor(message: string, public status: number, public dailyQuotaUsed = false) {
    super(message);
  }
}

const CALL_TIMEOUT_MS = 12000;
const TOTAL_BUDGET_MS = 50000; // the API route may run for 60 s

async function callGemini(model: string, key: string, contents: Content[]) {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      tools: [{ functionDeclarations: DECLARATIONS }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AgentError(`Gemini ${res.status}: ${body.slice(0, 1500)}`, res.status);
  }
  return (await res.json()) as { candidates?: { content?: Content; finishReason?: string }[] };
}

export async function ask(history: ChatTurn[], key: string) {
  const contents: Content[] = history.map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] }));
  const steps: ToolStep[] = [];
  const MODELS = await modelList(key);
  const started = Date.now();
  let modelIndex = 0;
  let dailyLimited = 0; // models that refused because today's free quota is used up

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    let data;
    try {
      data = await callGemini(MODELS[modelIndex], key, contents);
    } catch (e) {
      // A timeout counts like "busy": move on to the next model.
      const status = e instanceof AgentError ? e.status : (e as Error).name === "TimeoutError" ? 503 : 0;
      const quota = (e as Error).message.match(/"quotaId":\s*"([^"]+)"/)?.[1];
      console.warn(`model ${MODELS[modelIndex]} failed with ${status || (e as Error).message}${quota ? ` (${quota})` : ""}`);
      if (quota?.includes("PerDay")) dailyLimited++;
      if (FALL_THROUGH.has(status) && modelIndex < MODELS.length - 1 && Date.now() - started < TOTAL_BUDGET_MS - CALL_TIMEOUT_MS) {
        modelIndex++;
        round--;
        continue;
      }
      throw new AgentError((e as Error).message, status || 500, dailyLimited > 0 && dailyLimited >= modelIndex);
    }
    const content = data.candidates?.[0]?.content;
    const parts = content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length || round === MAX_ROUNDS) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return { answer: text || "Sorry, I couldn't produce an answer. Please rephrase the question.", steps, model: MODELS[modelIndex] };
    }
    // Keep the model's turn exactly as sent (it may carry thought signatures), then answer each call.
    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: calls.map((p) => {
        const { name, args = {} } = p.functionCall!;
        steps.push({ name, args });
        return { functionResponse: { name, response: { result: runTool(name, args) } } };
      }),
    });
  }
  throw new AgentError("Too many tool rounds", 500);
}

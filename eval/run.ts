/*
 * Evaluation of the AI assistant against the live API.
 *   npx tsx eval/run.ts [base-url]
 *
 * For each test question it checks:
 *   1. tools    - did the agent call the right tool(s)?
 *   2. content  - does the answer mention what it must (and avoid what it must not)?
 *   3. grounded - is every AED amount and percentage in the answer backed by a number in the tool
 *                 results? The tools are deterministic, so they are re-run here with the same
 *                 arguments the agent used, and the answer's numbers are matched against them.
 * Results go to eval/results.md and eval/results.json.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTool } from "../src/lib/assistant/tools";
import { market } from "../src/lib/data";

const BASE = process.argv[2] ?? "https://dubai-property-iq.vercel.app";
const PAUSE_MS = 40000; // stay inside the Gemini free tier's requests-per-minute limit

type Case = { q: string; tools?: string[]; noTools?: boolean; mention?: (string | string[])[]; forbid?: string[]; kind: string };

const CASES: Case[] = [
  { kind: "search", q: "Where can I buy a 2 bedroom apartment under AED 1.5M near a metro?", tools: ["search_areas"], mention: ["International City", "metro"] },
  { kind: "search", q: "Cheapest areas for a 4 bedroom villa", tools: ["search_areas"] },
  { kind: "search", q: "Which areas have 1 bedroom apartments under AED 800K?", tools: ["search_areas"] },
  { kind: "compare", q: "Compare JVC, Business Bay and Dubai Marina", tools: ["compare_areas", "get_area"], mention: [["Jumeirah Village Circle", "JVC"], "Business Bay", "Dubai Marina"] },
  { kind: "area", q: "Tell me about Downtown", tools: ["get_area"], mention: [["Burj Khalifa", "Downtown"]] },
  { kind: "area", q: "How much is Palm Jumeirah per square foot?", tools: ["get_area", "compare_areas", "search_areas"], mention: ["Palm Jumeirah"] },
  { kind: "area", q: "What does a studio in JVC typically sell for?", tools: ["get_area", "search_areas", "estimate_price"], mention: [["Jumeirah Village Circle", "JVC"]] },
  { kind: "estimate", q: "What would a 1 bedroom, 750 sq ft off-plan flat in Business Bay cost?", tools: ["estimate_price"], mention: ["Business Bay"] },
  { kind: "estimate", q: "Estimate a 3 bedroom villa in Dubai Hills, 3000 sq ft, ready", tools: ["estimate_price"], mention: ["Dubai Hills"] },
  { kind: "estimate", q: "Price of a 70 square metre 1 bedroom apartment in JLT?", tools: ["estimate_price"], mention: [["Jumeirah Lakes Towers", "JLT"]] },
  { kind: "market", q: "Are Dubai prices really falling?", tools: ["market_overview"], mention: ["like-for-like"] },
  { kind: "market", q: "What is the busiest area in Dubai?", tools: ["market_overview", "search_areas"], mention: [market.top.busiest[0].name] },
  { kind: "market", q: "Which area is the most expensive per square foot?", tools: ["market_overview", "search_areas"], mention: [market.top.expensive[0].name] },
  { kind: "market", q: "How much more do off-plan apartments cost than ready ones?", tools: ["market_overview", "get_area"], mention: ["off-plan"] },
  { kind: "value", q: "Which projects sold below the price the model expects?", tools: ["value_projects"], mention: ["House of Well"] },
  { kind: "hinglish", q: "JVC mein 1 BHK flat kitne ka milta hai?", tools: ["get_area", "search_areas", "estimate_price"], mention: [["Jumeirah Village Circle", "JVC"]] },
  { kind: "limits", q: "What is the rental yield in Dubai Marina?", mention: [["rent", "yield"]] },
  { kind: "limits", q: "What are property prices like in Abu Dhabi?", mention: ["Dubai"], forbid: ["Abu Dhabi's median", "in Abu Dhabi is AED"] },
  { kind: "limits", q: "Should I buy an apartment in JVC right now?", mention: [["not financial advice", "isn't financial advice", "not investment advice", "not a financial"]] },
  { kind: "off-topic", q: "Who won the cricket match yesterday?", noTools: true },
];

// ---------- number grounding ----------
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (typeof value === "string") for (const m of value.matchAll(/-?\d[\d,]*\.?\d*/g)) out.push(Number(m[0].replace(/,/g, "")));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

type Claim = { text: string; value: number; tol: number; percent: boolean };
function claimsIn(answer: string): Claim[] {
  const claims: Claim[] = [];
  const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, million: 1e6, bn: 1e9, billion: 1e9 };
  for (const m of answer.matchAll(/AED\s*([\d,]+(?:\.\d+)?)\s*(k|m|b|million|bn|billion)?\b/gi)) {
    const digits = m[1].replace(/,/g, "");
    const unit = mult[(m[2] ?? "").toLowerCase()] ?? 1;
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
    const value = Number(digits) * unit;
    claims.push({ text: m[0], value, tol: (0.5 * unit) / 10 ** decimals + value * 0.01, percent: false });
  }
  for (const m of answer.matchAll(/([+-−]?\d+(?:\.\d+)?)\s*%/g)) {
    const raw = m[1].replace("−", "-");
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    claims.push({ text: m[0], value: Math.abs(Number(raw)), tol: 0.5 / 10 ** decimals + 0.15, percent: true });
  }
  return claims;
}

function grounded(claim: Claim, facts: number[]) {
  return facts.some((f) => {
    const candidates = claim.percent ? [Math.abs(f * 100), Math.abs(f), Math.abs((f - 1) * 100)] : [Math.abs(f)];
    return candidates.some((c) => Math.abs(c - claim.value) <= claim.tol);
  });
}

// ---------- run ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askApi(q: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const t = Date.now();
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/assistant`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", text: q }] }), signal: AbortSignal.timeout(80000) });
    } catch (e) {
      console.log(`   (request failed: ${(e as Error).message}; retrying)`);
      await sleep(30000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    // 429 means the free Gemini quota is busy: wait and ask again rather than count it as a wrong answer.
    if (res.status === 429) { console.log("   (quota busy, waiting 60 s)"); await sleep(60000); continue; }
    return { ok: res.ok, status: res.status, ms: Date.now() - t, ...data } as { ok: boolean; status: number; ms: number; answer?: string; steps?: { name: string; args: Record<string, unknown> }[]; model?: string; error?: string };
  }
  return { ok: false, status: 429, ms: 0, error: "rate limited" };
}

const lc = (s: string) => s.toLowerCase();

async function main() {
const results = [];
for (const [i, c] of CASES.entries()) {
  if (i) await sleep(PAUSE_MS);
  const r = await askApi(c.q);
  const answer = r.answer ?? "";
  const steps = r.steps ?? [];
  const used = steps.map((s) => s.name);
  const toolsOk = c.noTools ? used.length === 0 : c.tools ? used.some((u) => c.tools!.includes(u)) : true;
  const missing = (c.mention ?? []).filter((m) => !(Array.isArray(m) ? m : [m]).some((x) => lc(answer).includes(lc(x))));
  const forbidden = (c.forbid ?? []).filter((f) => lc(answer).includes(lc(f)));
  const contentOk = r.ok && missing.length === 0 && forbidden.length === 0;
  const facts = steps.flatMap((s) => numbersIn(runTool(s.name, s.args)));
  const claims = claimsIn(answer);
  const ungrounded = claims.filter((cl) => !grounded(cl, facts)).map((cl) => cl.text);
  const pass = r.ok && toolsOk && contentOk && ungrounded.length === 0;
  results.push({ ...c, mention: undefined, pass, toolsOk, contentOk, used, claims: claims.length, ungrounded, missing: missing.map(String), forbidden, ms: r.ms, model: r.model, status: r.status, error: r.error, answer });
  console.log(`${pass ? "PASS" : "FAIL"} [${c.kind}] ${c.q}\n   tools: ${used.join(", ") || "none"} | numbers ${claims.length - ungrounded.length}/${claims.length} grounded${ungrounded.length ? " (not found: " + ungrounded.join(", ") + ")" : ""}${missing.length ? " | missing: " + missing.join(", ") : ""}${r.error ? " | error: " + r.error : ""} | ${r.ms} ms`);
}

const n = results.length;
const passed = results.filter((r) => r.pass).length;
const totalClaims = results.reduce((s, r) => s + r.claims, 0);
const badClaims = results.reduce((s, r) => s + r.ungrounded.length, 0);
const summary = {
  date: new Date().toISOString().slice(0, 10),
  base: BASE,
  model: results.find((r) => r.model)?.model,
  questions: n,
  passed,
  tool_choice: results.filter((r) => r.toolsOk).length,
  content: results.filter((r) => r.contentOk).length,
  numbers_checked: totalClaims,
  numbers_grounded: totalClaims - badClaims,
  median_ms: results.map((r) => r.ms).sort((a, b) => a - b)[n >> 1],
};
console.log(summary);

const md = [
  "# Assistant evaluation",
  "",
  `Run on ${summary.date} against ${BASE} (model: ${summary.model}). Re-run with \`npx tsx eval/run.ts\`.`,
  "",
  "| Metric | Result |",
  "|---|---|",
  `| Questions passed (all checks) | **${passed} / ${n}** |`,
  `| Right tool chosen | ${summary.tool_choice} / ${n} |`,
  `| Required content present | ${summary.content} / ${n} |`,
  `| AED amounts and percentages traced to tool results | **${summary.numbers_grounded} / ${totalClaims}** |`,
  `| Median response time | ${(summary.median_ms / 1000).toFixed(1)} s |`,
  "",
  "A number counts as grounded when it matches a value in the tool results (allowing for the rounding shown, e.g. AED 1.2M). Numbers the model worked out itself, such as a difference between two areas, count as not grounded.",
  "",
  "| | Type | Question | Tools used | Numbers grounded | Notes |",
  "|---|---|---|---|---|---|",
  ...results.map((r) => `| ${r.pass ? "✅" : "❌"} | ${r.kind} | ${r.q} | ${r.used.join(", ") || "none"} | ${r.claims - r.ungrounded.length}/${r.claims} | ${[r.ungrounded.length ? "not found: " + r.ungrounded.join(", ") : "", r.missing.length ? "missing: " + r.missing.join(", ") : "", r.toolsOk ? "" : "unexpected tools", r.error ?? ""].filter(Boolean).join("; ")} |`),
  "",
  "## Answers",
  "",
  ...results.flatMap((r) => [`### ${r.q}`, "", r.answer ? r.answer.split("\n").map((l) => `> ${l}`).join("\n") : `_${r.error}_`, ""]),
].join("\n");
writeFileSync(join(__dirname, "results.md"), md);
writeFileSync(join(__dirname, "results.json"), JSON.stringify({ summary, results }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

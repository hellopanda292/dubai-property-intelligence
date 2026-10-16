import type { Metadata } from "next";
import { Assistant } from "@/components/Assistant";
import { SectionTitle } from "@/components/ui";
import { market, meta } from "@/lib/data";
import { dateLabel, num } from "@/lib/format";

export const metadata: Metadata = {
  title: "AI assistant",
  description: "Ask about Dubai property in plain language. A Gemini agent answers by calling tools over official DLD sales data, so every number is real.",
};

const TOOLS = [
  ["search_areas", "Finds areas by budget, home type, bedrooms and DLD's nearest-metro field"],
  ["get_area", "One area's prices by bedroom, top projects and price change"],
  ["compare_areas", "Key numbers for up to four areas side by side"],
  ["estimate_price", "Runs the site's machine-learning price model"],
  ["market_overview", "Dubai-wide numbers, including like-for-like price change"],
  ["value_projects", "Projects that sold below or above what the model expects"],
];

export default function AssistantPage() {
  return (
    <div className="container-app pt-10">
      <p className="eyebrow">AI agent · Gemini + tools</p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-bold tracking-[-0.04em]">Ask the data</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Ask in plain English, Hindi or Arabic. The AI doesn’t guess prices: it calls tools that look up {num(market.sales)} real DLD
        sales ({dateLabel(meta.period.from)} to {dateLabel(meta.period.to)}) and then explains the result.
      </p>

      <div className="mt-8">
        <Assistant />
      </div>

      <section className="mt-14">
        <SectionTitle eyebrow="How it works" title="A language model that has to show its work">
          Gemini decides which tools to call and with what filters. The tools are plain TypeScript functions over the same data as the rest of
          this site, and every answer lists the lookups it used under “Data used”.
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(([name, desc]) => (
            <div key={name} className="card p-4">
              <p className="font-mono text-sm font-bold text-violet">{name}</p>
              <p className="mt-1 text-sm text-ink-soft">{desc}</p>
            </div>
          ))}
        </div>
        <ul className="mt-6 max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>It only knows 2026 residential sales. It can’t answer about rents, other emirates, mortgages or a specific unit, and says so.</li>
          <li>“Nearest metro” is a field DLD records for each sale, not a measured walking distance.</li>
          <li>It is checked against a set of test questions with known answers (see the project’s GitHub). It can still make mistakes, so check the linked area pages.</li>
          <li>Not financial advice.</li>
        </ul>
      </section>
    </div>
  );
}

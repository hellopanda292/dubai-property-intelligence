import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Lines } from "@/components/charts";
import { insights, slugFor } from "@/lib/data";
import { bedroomLabel, monthLabel, num, pct, signedPct } from "@/lib/format";
import type { ProjectValue } from "@/lib/types";

export const metadata: Metadata = {
  title: "Market insights",
  description: "Five questions about Dubai's 2026 property market, answered with like-for-like comparisons of official DLD sales.",
};

function Question({ n, title, answer, children, method }: { n: number; title: string; answer: ReactNode; children: ReactNode; method: ReactNode }) {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby={`q${n}`}>
      <p className="eyebrow">Question {n}</p>
      <h2 id={`q${n}`} className="mt-1.5 font-display text-[clamp(1.4rem,3vw,1.9rem)] font-bold leading-tight tracking-[-0.03em]">{title}</h2>
      <div className="mt-3 text-[17px] leading-relaxed text-ink-soft">{answer}</div>
      <div className="mt-5">{children}</div>
      <details className="mt-5 rounded-2xl bg-paper p-4 text-sm text-ink-soft">
        <summary className="cursor-pointer font-bold text-ink">How this was measured</summary>
        <div className="mt-2 space-y-2 leading-relaxed">{method}</div>
      </details>
    </section>
  );
}

function Big({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "good" | "bad" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-violet";
  return <strong className={`font-display text-[1.15em] ${color}`}>{children}</strong>;
}

function AreaLink({ name }: { name: string }) {
  const slug = slugFor(name);
  return slug ? <Link href={`/areas/${slug}`} className="font-semibold hover:text-violet">{name}</Link> : <span className="font-semibold">{name}</span>;
}

function ProjectTable({ rows, tone }: { rows: ProjectValue[]; tone: "good" | "bad" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
            <th scope="col" className="w-[38%] py-2 pr-3">Project</th>
            <th scope="col" className="w-[26%] py-2 pr-3">Area</th>
            <th scope="col" className="py-2 pr-3 text-right">Sales</th>
            <th scope="col" className="py-2 pr-3 text-right">AED / sq ft</th>
            <th scope="col" className="py-2 text-right">vs similar homes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.project} className="border-t border-ink/5">
              <td className="py-2.5 pr-3 font-semibold">{p.project}</td>
              <td className="py-2.5 pr-3"><AreaLink name={p.area} /></td>
              <td className="py-2.5 pr-3 text-right">{num(p.sales)}</td>
              <td className="py-2.5 pr-3 text-right">{num(p.median_ppsf)}</td>
              <td className={`py-2.5 text-right font-bold ${tone === "good" ? "text-good" : "text-bad"}`}>{signedPct(p.premium, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InsightsPage() {
  const flat = insights.models.Flat;
  const villa = insights.models.Villa;
  const lastFlat = flat.index[flat.index.length - 1];
  const lastVilla = villa.index[villa.index.length - 1];
  const indexData = flat.index.map((p, i) => ({
    month: monthLabel(p.month),
    flatRaw: p.raw_median,
    flatLfl: p.like_for_like,
    villaLfl: villa.index[i]?.like_for_like,
  }));
  const studio = insights.bedrooms.find((b) => b.bedrooms === 0);
  const maxRel = Math.max(...insights.bedrooms.map((b) => b.relative_ppsf));
  const firstMonth = monthLabel(flat.index[0].month);
  const lastMonth = monthLabel(lastFlat.month);

  return (
    <div className="container-app max-w-5xl pt-10">
      <p className="eyebrow">Insights</p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.2rem)] font-bold leading-[1.05] tracking-[-0.04em]">
        Five questions about Dubai’s 2026 market
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Simple averages can mislead: if more cheap homes happen to sell this month, the average falls even when no home got cheaper.
        So each answer here compares <strong className="text-ink">like with like</strong>: homes in the same area, of the same type and
        with the same number of bedrooms.
      </p>

      <div className="mt-10 grid gap-6">
        <Question
          n={1}
          title="Are Dubai prices really falling?"
          answer={
            <>
              The median apartment price per sq ft moved <Big tone="bad">{signedPct(lastFlat.raw_median - 1)}</Big> from {firstMonth} to {lastMonth}, but
              comparing like with like the change is only <Big>{signedPct(lastFlat.like_for_like - 1)}</Big>. Most of the “fall” is because cheaper homes
              made up more of the later sales. Villas: {signedPct(lastVilla.raw_median - 1)} raw, {signedPct(lastVilla.like_for_like - 1)} like for like.
            </>
          }
          method={
            <>
              <p>A fixed-effects regression of log(price per sq ft) on month, with one fixed effect per area × type × bedroom group, controlling for size and off-plan status. Each month’s coefficient is the like-for-like change compared with {firstMonth}.</p>
              <p>Implemented with the within transformation (subtract each group’s mean, then least squares), which gives the same answer as one dummy variable per group.</p>
            </>
          }
        >
          <Lines
            data={indexData}
            xKey="month"
            kind="index"
            series={[
              { key: "flatRaw", label: "Apartments: simple median", color: "#d63c8f", dashed: true },
              { key: "flatLfl", label: "Apartments: like for like", color: "#2b59ff" },
              { key: "villaLfl", label: "Villas: like for like", color: "#0fb5d4" },
            ]}
          />
          <h3 className="mt-6 font-display text-lg font-bold">Busiest areas: Jan–Mar vs Jul–Sep</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
                  <th scope="col" className="w-[26%] py-2 pr-3">Area</th>
                  <th scope="col" className="py-2 pr-3 text-right">Simple median</th>
                  <th scope="col" className="py-2 text-right">Like for like</th>
                </tr>
              </thead>
              <tbody>
                {insights.area_changes.map((a) => (
                  <tr key={a.area} className="border-t border-ink/5">
                    <td className="py-2.5 pr-3"><AreaLink name={a.area} /></td>
                    <td className={`py-2.5 pr-3 text-right ${a.raw_change >= 0 ? "text-good" : "text-bad"}`}>{signedPct(a.raw_change)}</td>
                    <td className={`py-2.5 text-right font-bold ${a.like_for_like >= 0 ? "text-good" : "text-bad"}`}>{signedPct(a.like_for_like)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Question>

        <Question
          n={2}
          title="How much more do buyers pay for off-plan?"
          answer={
            <>
              For apartments, an off-plan home sells for <Big>{signedPct(flat.offplan_premium, 0)}</Big> per sq ft compared with a ready one of the same
              area, bedrooms and size. For villas the difference is small ({signedPct(villa.offplan_premium, 0)}). Buyers pay extra for brand-new
              buildings and developer payment plans, but the premium varies a lot by area.
            </>
          }
          method={
            <>
              <p>Headline: the off-plan coefficient of the fixed-effects regression above (same area, type and bedrooms; controls for size and month).</p>
              <p>By area: within each type + bedroom group with at least 15 off-plan and 15 ready sales, the ratio of median prices per sq ft, averaged across groups. New off-plan buildings also tend to be newer and better equipped, so the premium includes that.</p>
            </>
          }
        >
          <ul className="space-y-2.5">
            {insights.offplan_areas.map((a) => {
              const w = Math.min(Math.abs(a.premium), 0.8) / 0.8;
              return (
                <li key={a.area} className="grid grid-cols-[minmax(0,1fr)_1.2fr_64px] items-center gap-3 text-sm">
                  <AreaLink name={a.area} />
                  <span className="h-2.5 overflow-hidden rounded-full bg-[#eceff8]">
                    <span className={`block h-full rounded-full ${a.premium >= 0 ? "bg-[linear-gradient(90deg,#7a4dff,#d63c8f)]" : "bg-cyan"}`} style={{ width: `${Math.max(w * 100, 2)}%` }} />
                  </span>
                  <span className="text-right font-bold tabular-nums">{signedPct(a.premium, 0)}</span>
                </li>
              );
            })}
          </ul>
        </Question>

        <Question
          n={3}
          title="Do studios cost more per square foot?"
          answer={
            <>
              Yes. Within the same area, a studio costs <Big>{studio ? signedPct(studio.relative_ppsf - 1, 0) : "–"}</Big> more per sq ft than a 1-bedroom
              apartment. Smaller homes still have a kitchen, a bathroom and a share of the building, so each square foot costs more. Two- and
              three-bedroom apartments cost about the same per sq ft as a 1-bedroom.
            </>
          }
          method={<p>For each area with at least 20 sales of both, the median price per sq ft of each bedroom count divided by the 1-bedroom median, averaged across areas (weighted by number of sales).</p>}
        >
          <ul className="space-y-2.5">
            {insights.bedrooms.map((b) => (
              <li key={b.bedrooms} className="grid grid-cols-[72px_1fr_64px] items-center gap-3 text-sm">
                <span className="font-semibold">{bedroomLabel(b.bedrooms)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-[#eceff8]">
                  <span className="block h-full rounded-full bg-[linear-gradient(90deg,#2b59ff,#7a4dff)]" style={{ width: `${(b.relative_ppsf / maxRel) * 100}%` }} />
                </span>
                <span className="text-right font-bold tabular-nums">{b.bedrooms === 1 ? "base" : signedPct(b.relative_ppsf - 1, 0)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">4-bedroom apartments: only {insights.bedrooms.find((b) => b.bedrooms === 4)?.areas ?? 0} areas had enough sales.</p>
        </Question>

        <Question
          n={4}
          title="Do bigger homes get a discount?"
          answer={
            <>
              A little. A home <strong className="text-ink">10% bigger</strong> than a similar one in the same area costs about{" "}
              <Big tone="good">{pct(Math.abs(flat.ppsf_change_10pct_bigger), 1)} less per sq ft</Big> for apartments ({pct(Math.abs(villa.ppsf_change_10pct_bigger), 1)} for
              villas), so its total price rises by roughly 6%, not 10%.
            </>
          }
          method={<p>The size coefficient (elasticity) of the same fixed-effects regression: log(price per sq ft) on log(size). Apartments: {flat.size_elasticity}, villas: {villa.size_elasticity}. 1.1 raised to that power gives the change for a 10% bigger home.</p>}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Apartments</p>
              <p className="mt-1 font-display text-2xl font-bold">{signedPct(flat.ppsf_change_10pct_bigger)}</p>
              <p className="text-sm text-ink-muted">per sq ft, 10% bigger</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Villas</p>
              <p className="mt-1 font-display text-2xl font-bold">{signedPct(villa.ppsf_change_10pct_bigger)}</p>
              <p className="text-sm text-ink-muted">per sq ft, 10% bigger</p>
            </div>
          </div>
        </Question>

        <Question
          n={5}
          title="Which projects sell above or below similar homes?"
          answer={
            <>
              The price model learned from every <em>other</em> project and predicted what each project’s homes “should” sell for, given their area,
              type, bedrooms, size and status. Of {num(insights.value.projects_scored)} projects with 30+ sales, {pct(insights.value.within_10)} sold within
              10% of that. The rest stand out, and the interesting question is why.
            </>
          }
          method={
            <>
              <p>5-fold cross-validation grouped by project (GroupKFold), so a project is never in the data its prediction was trained on. The score is the median of actual ÷ predicted price over the project’s sales. Cross-validated median error: {pct(insights.value.cv_median_error, 1)}.</p>
              <p>A premium usually reflects things the data doesn’t contain: brand, views, finishing, amenities or payment plans. A discount can mean an older or smaller building, a weaker location inside the area, or unusual deals. This is a starting point for research, not a buy or sell signal.</p>
            </>
          }
        >
          <div className="grid gap-8">
            <div>
              <h3 className="font-display text-lg font-bold">Selling at a premium</h3>
              <ProjectTable rows={insights.value.above} tone="bad" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Selling below similar homes</h3>
              <ProjectTable rows={insights.value.below} tone="good" />
            </div>
          </div>
        </Question>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        All figures are statistics of past sales registered with the Dubai Land Department, not valuations or financial advice. For
        typical prices see the <Link href="/" className="underline">market page</Link> and each <Link href="/areas" className="underline">area page</Link>.
      </p>
    </div>
  );
}

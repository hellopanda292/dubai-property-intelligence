import type { Metadata } from "next";
import { SectionTitle } from "@/components/ui";
import { market, meta } from "@/lib/data";
import { dateLabel, monthLabel, num, pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Method",
  description: "Where the data comes from, how it is cleaned, and how accurate the price model is.",
};

export default function AboutPage() {
  const m = meta.model;
  const rows = [
    { name: "Baseline: area median × size", ...m.baseline },
    { name: "Gradient boosting (this site)", ...m.model },
  ];

  return (
    <div className="container-app max-w-4xl pt-10">
      <p className="eyebrow">Method</p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-bold tracking-[-0.04em]">How the numbers are made</h1>
      <p className="mt-3 text-ink-soft">
        Everything on this site comes from one public source and a short, repeatable pipeline. Nothing is estimated by hand.
      </p>

      <section className="mt-10">
        <SectionTitle eyebrow="1 · Data" title="Official Dubai Land Department sales">
          Every sale registered with the DLD between {dateLabel(meta.period.from)} and {dateLabel(meta.period.to)}, downloaded from
          the DLD{" "}
          <a className="font-semibold text-violet underline" href="https://dubailand.gov.ae/en/open-data/real-estate-data/" target="_blank" rel="noopener noreferrer">
            Real Estate Data
          </a>{" "}
          page. Prices are what buyers actually paid, not asking prices from listing websites.
        </SectionTitle>
      </section>

      <section className="mt-10">
        <SectionTitle eyebrow="2 · Cleaning" title={`${num(meta.cleaning.sales[0].rows)} transactions → ${num(market.sales)} clean sales`} />
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {meta.cleaning.sales.map((s, i) => (
                <tr key={s.step} className={i ? "border-t border-ink/5" : ""}>
                  <td className="px-4 py-3">{s.step}</td>
                  <td className="px-4 py-3 text-right font-bold">{num(s.rows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Only apartments and villas used as homes; offices, shops, land and hotel rooms are priced differently.</li>
          <li>Lease-to-own and bulk developer registrations are removed: they are not market sales.</li>
          <li>Realistic sizes (apartments 200–6,000 sq ft, villas 700–20,000 sq ft), price at least AED 100,000.</li>
          <li>The most extreme 0.5% of prices per sq ft on each side are dropped as likely entry errors.</li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionTitle eyebrow="3 · Model" title="Gradient boosting, tested honestly">
          The model learns from {monthLabel(m.train_months[0])}–{monthLabel(m.train_months[1])} sales and is tested on the two most recent months (
          {m.test_months.map(monthLabel).join(" and ")}), which it never saw: the same situation as estimating tomorrow’s sales from today’s data.
          Areas are encoded by their typical price per sq ft (smoothed target encoding).
        </SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
                <th scope="col" className="px-4 py-3">Method</th>
                <th scope="col" className="px-4 py-3 text-right">Median error</th>
                <th scope="col" className="px-4 py-3 text-right">Within 10%</th>
                <th scope="col" className="px-4 py-3 text-right">Within 20%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className={`border-t border-ink/5 ${i === 1 ? "font-bold" : ""}`}>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3 text-right">{pct(r.median_error, 1)}</td>
                  <td className="px-4 py-3 text-right">{pct(r.within_10)}</td>
                  <td className="px-4 py-3 text-right">{pct(r.within_20)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          The 400 trees are exported to JSON and run in your browser; the pipeline checks they give exactly the same answers as scikit-learn.
        </p>
      </section>

      <section className="mt-10">
        <SectionTitle eyebrow="4 · Limits" title="What this can’t tell you" />
        <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>View, floor, building age, finishing and exact location inside an area all affect real prices, and none of them are in the data.</li>
          <li>Changes in an area’s median can reflect <em>which</em> projects sold (for example a new luxury tower), not only price movement.</li>
          <li>This is an independent student project, not affiliated with the Dubai Land Department, and not a valuation or financial advice.</li>
        </ul>
      </section>
    </div>
  );
}

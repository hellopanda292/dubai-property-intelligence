import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, Landmark, MapPin, ShoppingBag, TrainFront } from "lucide-react";
import { Lines, StackedBars } from "@/components/charts";
import { Badge, ButtonLink, SectionTitle, Stat } from "@/components/ui";
import { areas, getArea, market } from "@/lib/data";
import { aed, aedShort, bedroomLabel, monthLabel, num, pct, signedPct, typeLabel } from "@/lib/format";

export function generateStaticParams() {
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const area = getArea((await params).slug);
  if (!area) return {};
  return {
    title: `${area.name} property prices`,
    description: `${area.name}, Dubai: ${num(area.sales)} sales in 2026, median ${aed(area.median_price)} (${aed(area.median_ppsf)} per sq ft). Prices by bedrooms, trends and top projects.`,
  };
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const area = getArea((await params).slug);
  if (!area) notFound();

  const vsCity = area.median_ppsf / market.median_ppsf - 1;
  const monthly = area.monthly.map((m) => ({ month: monthLabel(m.month), Sales: m.sales, ppsf: m.median_ppsf }));
  const places = [
    { icon: TrainFront, label: "Nearest metro", place: area.metro },
    { icon: ShoppingBag, label: "Nearest mall", place: area.mall },
    { icon: Landmark, label: "Nearest landmark", place: area.landmark },
  ].filter((p) => p.place);

  return (
    <div className="container-app pt-8">
      <Link href="/areas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All areas
      </Link>

      <header className="mt-4">
        <p className="eyebrow flex items-center gap-2"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Dubai area</p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] font-bold leading-[1.03] tracking-[-0.04em]">{area.name}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={vsCity >= 0 ? "brand" : "good"}>
            {Math.abs(vsCity) < 0.03 ? "About the Dubai average" : `${pct(Math.abs(vsCity))} ${vsCity > 0 ? "above" : "below"} the Dubai median per sq ft`}
          </Badge>
          {area.ppsf_change !== null && (
            <Badge tone={area.ppsf_change >= 0 ? "good" : "bad"}>{signedPct(area.ppsf_change)} price per sq ft, Q1 → Q3</Badge>
          )}
          <Badge>{pct(area.offplan_share)} off-plan</Badge>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <Stat label="Sales in 2026" value={num(area.sales)} hint={`${aedShort(area.total_value)} total`} />
        <Stat label="Median price" value={aedShort(area.median_price)} />
        <Stat label="Median per sq ft" value={aed(area.median_ppsf)} hint={`Dubai: ${aed(market.median_ppsf)}`} />
        <Stat
          label="Property mix"
          value={area.villa_share >= 0.5 ? "Mostly villas" : area.villa_share > 0.05 ? "Mixed" : "Apartments"}
          hint={`${pct(1 - area.villa_share)} apartments · ${pct(area.villa_share)} villas`}
        />
      </section>

      {places.length > 0 && (
        <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Nearby">
          {places.map(({ icon: Icon, label, place }) => (
            <div key={label} className="card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef1ff] text-violet"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
                <p className="truncate font-semibold">{place!.name}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Median price per sq ft by month</h2>
          <Lines data={monthly} xKey="month" series={[{ key: "ppsf", label: "AED per sq ft", color: "#7a4dff" }]} height={240} />
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Sales by month</h2>
          <StackedBars data={monthly} xKey="month" series={[{ key: "Sales", label: "Sales", color: "#2b59ff" }]} height={240} />
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle eyebrow="Budgets" title={`Prices in ${area.name} by bedrooms`}>
          The typical range is the middle half of sales (25th to 75th percentile). Groups with fewer than 5 sales are hidden.
        </SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
                <th scope="col" className="px-4 py-3">Home</th>
                <th scope="col" className="px-4 py-3 text-right">Sales</th>
                <th scope="col" className="px-4 py-3 text-right">Median price</th>
                <th scope="col" className="px-4 py-3 text-right">Typical range</th>
                <th scope="col" className="px-4 py-3 text-right">AED / sq ft</th>
                <th scope="col" className="px-4 py-3 text-right">Typical size</th>
              </tr>
            </thead>
            <tbody>
              {area.bedrooms.map((b) => (
                <tr key={`${b.type}-${b.bedrooms}`} className="border-t border-ink/5">
                  <td className="px-4 py-3 font-semibold">{bedroomLabel(b.bedrooms)} {typeLabel(b.type).toLowerCase()}</td>
                  <td className="px-4 py-3 text-right">{num(b.sales)}</td>
                  <td className="px-4 py-3 text-right font-bold">{aedShort(b.median_price)}</td>
                  <td className="px-4 py-3 text-right text-ink-soft">{aedShort(b.p25_price)} – {aedShort(b.p75_price)}</td>
                  <td className="px-4 py-3 text-right">{num(b.median_ppsf)}</td>
                  <td className="px-4 py-3 text-right">{num(b.median_sqft)} sq ft</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {area.projects.length > 0 && (
        <section className="mt-12">
          <SectionTitle eyebrow="Projects" title="Most-sold projects" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {area.projects.map((p) => (
              <div key={p.name} className="card p-4">
                <p className="font-bold leading-snug">{p.name}</p>
                <p className="mt-2 text-sm text-ink-soft">{num(p.sales)} sales · median {aedShort(p.median_price)}</p>
                <p className="mt-1 text-sm text-ink-soft">{aed(p.median_ppsf)} / sq ft · {pct(p.offplan_share)} off-plan</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-12 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Have a specific home in mind?</h2>
          <p className="mt-1 text-ink-soft">Estimate its price in {area.name} with the machine-learning model.</p>
        </div>
        <ButtonLink href={`/estimate?area=${area.slug}`}>
          <Calculator className="h-4 w-4" aria-hidden="true" /> Estimate a price
        </ButtonLink>
      </section>
    </div>
  );
}

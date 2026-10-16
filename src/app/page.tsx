import Link from "next/link";
import { ArrowRight, Bot, Calculator, Crown, Flame, Lightbulb, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { AreaSearch } from "@/components/AreaSearch";
import { Lines, StackedBars } from "@/components/charts";
import { RankCard } from "@/components/RankCard";
import { Badge, ButtonLink, SectionTitle, Stat } from "@/components/ui";
import { areaIndex, insights, market, meta } from "@/lib/data";
import { aed, aedShort, bedroomLabel, dateLabel, monthLabel, num, pct, signedPct } from "@/lib/format";

export default function HomePage() {
  const monthly = market.monthly.map((m) => ({
    month: monthLabel(m.month),
    Apartments: m.flat_sales ?? 0,
    Villas: m.villa_sales ?? 0,
    apartmentPpsf: m.flat_ppsf,
    villaPpsf: m.villa_ppsf,
  }));
  const flat = market.by_type.Flat;
  const villa = market.by_type.Villa;

  return (
    <>
      {/* Hero */}
      <section className="container-app pb-10 pt-12 sm:pt-16">
        <p className="eyebrow flex flex-wrap items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[linear-gradient(135deg,#2b59ff,#d63c8f)]" aria-hidden="true" />
          Dubai real estate · Official DLD data · Updated {dateLabel(meta.period.to)}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.3rem)] font-bold leading-[1.02] tracking-[-0.04em]">
          Understand Dubai’s property market <span className="text-gradient">in seconds.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft sm:text-lg">
          Prices, trends and top projects for {market.areas} areas, plus a machine-learning price estimator, all built on{" "}
          <strong className="text-ink">{num(market.sales)} real sales</strong> registered with the Dubai Land Department in 2026.
        </p>
        <div className="mt-8">
          <AreaSearch areas={areaIndex} />
        </div>
      </section>

      {/* Key numbers */}
      <section className="container-app grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <Stat label="Total sales value" value={aedShort(market.total_value)} hint={`${num(market.sales)} residential sales`} />
        <Stat label="Typical apartment" value={aedShort(flat.median_price)} hint={`${aed(flat.median_ppsf)} per sq ft`} />
        <Stat label="Typical villa" value={aedShort(villa.median_price)} hint={`${aed(villa.median_ppsf)} per sq ft`} />
        <Stat label="Bought off-plan" value={pct(market.offplan_share)} hint="sold before the building was finished" />
      </section>

      {/* Charts */}
      <section className="container-app mt-12 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Sales per month</h2>
          <p className="text-sm text-ink-muted">The latest month is partial.</p>
          <div className="mt-3">
            <StackedBars data={monthly} xKey="month" series={[{ key: "Apartments", label: "Apartments", color: "#2b59ff" }, { key: "Villas", label: "Villas", color: "#d63c8f" }]} />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">Median price per sq ft</h2>
          <p className="text-sm text-ink-muted">AED, all areas together.</p>
          <div className="mt-3">
            <Lines data={monthly} xKey="month" series={[{ key: "apartmentPpsf", label: "Apartments", color: "#2b59ff" }, { key: "villaPpsf", label: "Villas", color: "#d63c8f" }]} />
          </div>
        </div>
      </section>

      {/* Rankings */}
      <section className="container-app mt-14">
        <SectionTitle eyebrow="Areas" title="Where the market is moving">
          Areas with at least 300 sales this year. Tap any area for its full picture.
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RankCard title="Busiest" icon={Flame} accent="linear-gradient(135deg,#7a4dff,#b98cff)" items={market.top.busiest} value={(i) => num(i.sales)} note="Number of sales" />
          <RankCard title="Most expensive" icon={Crown} accent="linear-gradient(135deg,#d63c8f,#ff9f6b)" items={market.top.expensive} value={(i) => num(i.median_ppsf!)} note="Median AED per sq ft" />
          <RankCard title="Most affordable" icon={Wallet} accent="linear-gradient(135deg,#0fb5d4,#2b59ff)" items={market.top.affordable} value={(i) => num(i.median_ppsf!)} note="Median AED per sq ft" />
          <RankCard title="Rising fastest" icon={TrendingUp} accent="linear-gradient(135deg,#138a52,#8fdc2a)" items={market.top.rising} value={(i) => signedPct(i.ppsf_change!)} note="Median AED per sq ft, Q1 vs Q3. Partly reflects which projects sold." />
        </div>
        <div className="mt-5">
          <ButtonLink href="/areas" variant="secondary">
            Compare all {market.areas} areas <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>

      {/* Bedrooms */}
      <section className="container-app mt-14">
        <SectionTitle eyebrow="Budgets" title="What a home typically costs">
          Median sale price by number of bedrooms, across Dubai.
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {(["Flat", "Villa"] as const).map((t) => (
            <div key={t} className="card p-5">
              <h3 className="font-display text-lg font-bold">{t === "Flat" ? "Apartments" : "Villas & townhouses"}</h3>
              <ul className="mt-3 space-y-2.5">
                {market.bedrooms
                  .filter((b) => b.type === t && b.bedrooms <= (t === "Flat" ? 4 : 6))
                  .map((b, _, rows) => {
                    const max = Math.max(...rows.map((r) => r.median_price));
                    return (
                      <li key={b.bedrooms} className="grid grid-cols-[64px_1fr_92px] items-center gap-3 text-sm">
                        <span className="font-semibold">{bedroomLabel(b.bedrooms)}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-[#eceff8]">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(b.median_price / max) * 100}%`, background: t === "Flat" ? "linear-gradient(90deg,#2b59ff,#7a4dff)" : "linear-gradient(90deg,#d63c8f,#ff9f6b)" }}
                          />
                        </span>
                        <span className="text-right font-bold tabular-nums">{aedShort(b.median_price)}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Insights teaser */}
      <section className="container-app mt-14">
        <Link href="/insights" className="card group flex flex-col gap-5 p-6 transition hover:-translate-y-0.5 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow flex items-center gap-2"><Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Insights</p>
            <h2 className="mt-2 font-display text-[clamp(1.4rem,3vw,2rem)] font-bold leading-tight tracking-[-0.03em]">Are Dubai prices really falling?</h2>
            <p className="mt-2 text-ink-soft">
              The simple median says apartments are {signedPct(insights.models.Flat.index.at(-1)!.raw_median - 1)} since January. Comparing like with like, the
              change is only {signedPct(insights.models.Flat.index.at(-1)!.like_for_like - 1)}. Read five questions answered with the data.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-violet">
            Read the insights <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
      </section>

      {/* Tools */}
      <section className="container-app mt-14 grid gap-4 md:grid-cols-3">
        <Link href="/estimate" className="card group p-6 transition hover:-translate-y-0.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,#2b59ff,#7a4dff)] text-white">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-display text-xl font-bold">Price estimator</h3>
          <p className="mt-1.5 text-sm text-ink-soft">
            A machine-learning model estimates a fair price from area, type, bedrooms, size and status. Median error{" "}
            {pct(meta.model.model.median_error, 1)} on unseen sales.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-violet">
            Estimate a price <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
        <div className="card p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,#0fb5d4,#138a52)] text-white">
            <PiggyBank className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 flex items-center gap-2 font-display text-xl font-bold">Rental yields <Badge tone="brand">Coming soon</Badge></h3>
          <p className="mt-1.5 text-sm text-ink-soft">Which areas give the best rent for the price? Combining DLD rent contracts with sale prices.</p>
        </div>
        <Link href="/assistant" className="card group p-6 transition hover:-translate-y-0.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,#d63c8f,#7a4dff)] text-white">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 flex items-center gap-2 font-display text-xl font-bold">AI assistant <Badge tone="brand">New</Badge></h3>
          <p className="mt-1.5 text-sm text-ink-soft">Ask in plain English, e.g. “2 bedroom under AED 1.5M near a metro”, and get answers worked out from the real data.</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-violet">
            Ask a question <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
      </section>
    </>
  );
}

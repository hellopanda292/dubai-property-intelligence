import type { Metadata } from "next";
import { AreasTable, type AreaRow } from "@/components/AreasTable";
import { areas, market } from "@/lib/data";

export const metadata: Metadata = {
  title: "All areas",
  description: `Compare prices, price per square foot, off-plan share and trends across ${market.areas} Dubai areas.`,
};

export default function AreasPage() {
  const rows: AreaRow[] = areas.map((a) => ({
    slug: a.slug,
    name: a.name,
    sales: a.sales,
    median_price: a.median_price,
    median_ppsf: a.median_ppsf,
    offplan_share: a.offplan_share,
    villa_share: a.villa_share,
    ppsf_change: a.ppsf_change,
    metro: a.metro?.name ?? null,
  }));

  return (
    <div className="container-app pt-10">
      <p className="eyebrow">Areas</p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-bold tracking-[-0.04em]">Compare {market.areas} Dubai areas</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every area with at least 20 residential sales in 2026. Sort by any column; “Q1 → Q3” is the change in median price per sq ft between
        the first and third quarter.
      </p>
      <div className="mt-8">
        <AreasTable rows={rows} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Estimator } from "@/components/Estimator";
import { areaIndex, areas, meta } from "@/lib/data";
import { pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Price estimator",
  description: "Estimate the price of an apartment or villa in Dubai with a gradient-boosting model trained on official 2026 sales.",
};

export default function EstimatePage() {
  const medians = Object.fromEntries(
    areas.map((a) => [a.name, Object.fromEntries(Object.entries(a.types).map(([t, s]) => [t, { median_ppsf: s!.median_ppsf, sales: s!.sales }]))]),
  );
  const m = meta.model;

  return (
    <div className="container-app pt-10">
      <p className="eyebrow">Machine learning</p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3rem)] font-bold tracking-[-0.04em]">What is a fair price?</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        A gradient-boosting model trained on {m.train_sales.toLocaleString("en-US")} sales estimates a price from the area, type,
        bedrooms, size and status. Tested on {m.test_sales.toLocaleString("en-US")} newer sales it had never seen, half of its
        estimates were within {pct(m.model.median_error, 1)} of the real price.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="card h-96" />}>
          <Estimator areas={areaIndex} medians={medians} />
        </Suspense>
      </div>
    </div>
  );
}

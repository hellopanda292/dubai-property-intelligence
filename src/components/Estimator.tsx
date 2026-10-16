"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { AreaIndexItem } from "@/lib/data";
import { aed, aedShort } from "@/lib/format";
import type { PropertyType } from "@/lib/types";

/*
 * The model is a gradient-boosting regressor trained in Python (pipeline/build.py) and exported
 * as plain JSON: each tree is a list of nodes. predictLogPpsf walks every tree and adds up the
 * leaf values, exactly like scikit-learn does (the pipeline asserts this).
 */
interface Tree { f: number[]; t: number[]; l: number[]; r: number[]; v: number[]; leaf: number[] }
interface Model {
  baseline: number;
  trees: Tree[];
  band: { low: number; high: number };
  type_value: Record<PropertyType, number>;
  global_value: number;
  areas: Record<string, { value: number; sales_log: number; types: Partial<Record<PropertyType, number>> }>;
}

const SQM_TO_SQFT = 10.7639;
const LIMITS = { Flat: { min: 200, max: 6000, beds: [0, 1, 2, 3, 4, 5, 6], size: 750, bed: 1 }, Villa: { min: 700, max: 20000, beds: [1, 2, 3, 4, 5, 6, 7], size: 2500, bed: 4 } };

function predictLogPpsf(model: Model, x: number[]) {
  let total = model.baseline;
  for (const tree of model.trees) {
    let i = 0;
    while (!tree.leaf[i]) i = x[tree.f[i]] <= tree.t[i] ? tree.l[i] : tree.r[i];
    total += tree.v[i];
  }
  return total;
}

const roundPrice = (n: number) => (n >= 1e6 ? Math.round(n / 10000) * 10000 : Math.round(n / 1000) * 1000);

function Segmented<T extends string | number>({ name, value, options, onChange }: { name: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-[#eef1f9] p-1">
      {options.map(([v, label]) => (
        <label key={String(v)} className="relative flex-1">
          <input type="radio" name={name} className="peer absolute inset-0 cursor-pointer opacity-0" checked={value === v} onChange={() => onChange(v)} />
          <span className="block whitespace-nowrap rounded-xl px-3 py-2.5 text-center text-sm font-bold text-ink-soft transition peer-checked:bg-white peer-checked:text-ink peer-checked:shadow peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-electric">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Estimator({ areas, medians }: { areas: AreaIndexItem[]; medians: Record<string, Partial<Record<PropertyType, { median_ppsf: number; sales: number }>>> }) {
  const params = useSearchParams();
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState(false);
  const initialArea = areas.find((a) => a.slug === params.get("area"))?.name ?? "Jumeirah Village Circle";
  const [area, setArea] = useState(initialArea);
  const [type, setType] = useState<PropertyType>("Flat");
  const [beds, setBeds] = useState(1);
  const [unit, setUnit] = useState<"sqft" | "sqm">("sqft");
  const [size, setSize] = useState(750);
  const [offplan, setOffplan] = useState(0);

  useEffect(() => {
    fetch("/model.json").then((r) => r.json()).then(setModel).catch(() => setError(true));
  }, []);

  const sqft = unit === "sqm" ? size * SQM_TO_SQFT : size;
  const limits = LIMITS[type];
  const valid = Number.isFinite(sqft) && sqft >= limits.min && sqft <= limits.max;
  const fmtSize = (s: number) => (unit === "sqm" ? `${Math.round(s / SQM_TO_SQFT)} m²` : `${s.toLocaleString("en-US")} sq ft`);

  const result = useMemo(() => {
    if (!model || !valid) return null;
    const enc = model.areas[area];
    if (!enc) return null;
    const x = [enc.value, enc.types[type] ?? model.type_value[type], enc.sales_log, type === "Villa" ? 1 : 0, offplan, beds, Math.log(sqft)];
    const ppsf = Math.exp(predictLogPpsf(model, x));
    return { ppsf, price: ppsf * sqft };
  }, [model, valid, area, type, offplan, beds, sqft]);

  const typical = medians[area]?.[type];
  const slug = areas.find((a) => a.name === area)?.slug;
  const word = type === "Villa" ? "villas" : "apartments";

  return (
    <div className="card grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr]">
      <form className="grid content-start gap-5" onSubmit={(e) => e.preventDefault()}>
        <label className="grid content-start gap-1.5">
          <span className="text-sm font-bold text-ink-soft">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-2xl border border-line bg-white px-3.5 py-3 text-[15px] focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15">
            {areas.map((a) => <option key={a.slug} value={a.name}>{a.name}</option>)}
          </select>
        </label>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-bold text-ink-soft">Property type</legend>
          <Segmented name="type" value={type} options={[["Flat", "Apartment"], ["Villa", "Villa / townhouse"]]} onChange={(t) => {
            setType(t);
            setBeds(LIMITS[t].bed);
            setSize(unit === "sqm" ? Math.round(LIMITS[t].size / SQM_TO_SQFT) : LIMITS[t].size);
          }} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
          <label className="grid content-start gap-1.5">
            <span className="text-sm font-bold text-ink-soft">Bedrooms</span>
            <select value={beds} onChange={(e) => setBeds(Number(e.target.value))} className="rounded-2xl border border-line bg-white px-3.5 py-3 text-[15px] focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15">
              {limits.beds.map((b) => <option key={b} value={b}>{b === 0 ? "Studio" : `${b} bedroom${b > 1 ? "s" : ""}`}</option>)}
            </select>
          </label>
          <div className="grid gap-1.5">
            <label htmlFor="size" className="text-sm font-bold text-ink-soft">Size</label>
            <div className="flex gap-2">
              <input id="size" type="number" inputMode="numeric" value={Number.isFinite(size) ? size : ""} onChange={(e) => setSize(Number(e.target.value))} aria-describedby="size-help"
                className="w-full min-w-0 rounded-2xl border border-line bg-white px-3.5 py-3 text-[15px] focus:border-electric focus:outline-none focus:ring-4 focus:ring-electric/15" />
              <div className="w-[136px] shrink-0">
                <Segmented name="unit" value={unit} options={[["sqft", "sq ft"], ["sqm", "m²"]]} onChange={(u) => {
                  setSize(u === "sqm" ? Math.round(sqft / SQM_TO_SQFT) : Math.round(sqft));
                  setUnit(u);
                }} />
              </div>
            </div>
            <p id="size-help" className={`text-xs ${valid ? "text-ink-muted" : "font-semibold text-bad"}`}>
              {valid ? "Accepted" : "Enter a size between"} {fmtSize(limits.min)} and {fmtSize(limits.max)} for {word}.
            </p>
          </div>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-bold text-ink-soft">Status</legend>
          <Segmented name="status" value={offplan} options={[[0, "Ready"], [1, "Off-plan"]]} onChange={setOffplan} />
        </fieldset>
      </form>

      <div className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] bg-ink p-6 text-white" aria-live="polite">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgba(214,60,143,0.55),transparent_60%),radial-gradient(70%_80%_at_0%_100%,rgba(43,89,255,0.6),transparent_60%)]" />
        <div className="relative flex flex-1 flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">Estimated price</p>
          <p className="font-display text-[clamp(2.2rem,6vw,3.3rem)] font-bold leading-none tracking-[-0.035em] tabular-nums">
            {error ? "Couldn't load the model" : !model ? "Loading…" : result ? aed(roundPrice(result.price)) : "–"}
          </p>
          {result && model && (
            <>
              <p className="text-sm text-white/80">
                Likely range {aedShort(roundPrice(result.price * model.band.low))} – {aedShort(roundPrice(result.price * model.band.high))}
                <span className="text-white/60"> (80% of test sales fell in this band)</span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60">Per sq ft</p>
                  <p className="font-bold tabular-nums">{aed(result.ppsf)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/60">Typical in area</p>
                  <p className="font-bold tabular-nums">{typical ? aed(typical.median_ppsf) : "–"}</p>
                </div>
              </div>
              {typical ? (
                <p className="text-sm text-white/85">
                  {Math.abs(result.ppsf / typical.median_ppsf - 1) < 0.03
                    ? `About the same per sq ft as typical ${word} sold in ${area}.`
                    : `${Math.round(Math.abs(result.ppsf / typical.median_ppsf - 1) * 100)}% ${result.ppsf > typical.median_ppsf ? "above" : "below"} the typical price per sq ft for ${word} in ${area}.`}
                </p>
              ) : null}
              {(!typical || typical.sales < 30) && (
                <p className="flex items-start gap-2 text-sm font-semibold text-[#ffd36b]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {typical ? `Only ${typical.sales} ${word} sold here in 2026, so treat this estimate with care.` : `No ${word} sold in ${area} in 2026, so this estimate is less reliable.`}
                </p>
              )}
            </>
          )}
          {slug && (
            <Link href={`/areas/${slug}`} className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-bold text-white hover:underline">
              See {area} market data <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <p className="text-xs text-white/55">An estimate from past sales, not a valuation or financial advice.</p>
        </div>
      </div>
    </div>
  );
}

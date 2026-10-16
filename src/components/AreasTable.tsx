"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { aed, aedShort, num, pct, signedPct } from "@/lib/format";

export interface AreaRow {
  slug: string;
  name: string;
  sales: number;
  median_price: number;
  median_ppsf: number;
  offplan_share: number;
  villa_share: number;
  ppsf_change: number | null;
  metro: string | null;
}

type SortKey = "name" | "sales" | "median_price" | "median_ppsf" | "offplan_share" | "ppsf_change";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Area", numeric: false },
  { key: "sales", label: "Sales", numeric: true },
  { key: "median_price", label: "Median price", numeric: true },
  { key: "median_ppsf", label: "AED / sq ft", numeric: true },
  { key: "offplan_share", label: "Off-plan", numeric: true },
  { key: "ppsf_change", label: "Q1 → Q3", numeric: true },
];

export function AreasTable({ rows }: { rows: AreaRow[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "villas" | "metro">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "sales", dir: -1 });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .filter((r) => (kind === "villas" ? r.villa_share >= 0.3 : kind === "metro" ? Boolean(r.metro) : true))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av === null) return 1;
        if (bv === null) return -1;
        return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
      });
  }, [rows, query, kind, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink/5 p-4">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-electric">
          <Search className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          <span className="sr-only">Filter areas by name</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name" className="h-10 w-full min-w-0 bg-transparent text-[15px] outline-none" />
        </label>
        <div className="flex gap-1 rounded-full bg-[#eef1f9] p-1" role="group" aria-label="Show">
          {([["all", "All areas"], ["villas", "Villa areas"], ["metro", "Near a metro"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${kind === k ? "bg-white text-ink shadow" : "text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="w-full text-xs text-ink-muted sm:w-auto" aria-live="polite">{shown.length} areas</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.08em] text-ink-muted">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-3 ${c.numeric ? "text-right" : ""}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 font-bold uppercase hover:text-ink">
                    {c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.slug} className="border-t border-ink/5 hover:bg-white/80">
                <td className="px-4 py-3">
                  <Link href={`/areas/${r.slug}`} className="font-bold hover:text-violet">{r.name}</Link>
                  {r.metro && <span className="block text-xs text-ink-muted">Metro: {r.metro}</span>}
                </td>
                <td className="px-4 py-3 text-right">{num(r.sales)}</td>
                <td className="px-4 py-3 text-right">{aedShort(r.median_price)}</td>
                <td className="px-4 py-3 text-right font-semibold">{aed(r.median_ppsf).replace("AED ", "")}</td>
                <td className="px-4 py-3 text-right">{pct(r.offplan_share)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.ppsf_change === null ? "text-ink-muted" : r.ppsf_change >= 0 ? "text-good" : "text-bad"}`}>
                  {r.ppsf_change === null ? "–" : signedPct(r.ppsf_change)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

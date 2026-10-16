"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { AreaIndexItem } from "@/lib/data";
import { aed } from "@/lib/format";

/** Accessible combobox: type an area name, pick with the mouse or arrow keys + Enter. */
export function AreaSearch({ areas, autoFocus = false }: { areas: AreaIndexItem[]; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...areas].sort((a, b) => b.sales - a.sales).slice(0, 6);
    return areas
      .filter((a) => a.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || b.sales - a.sales)
      .slice(0, 8);
  }, [areas, query]);

  const go = (slug: string) => router.push(`/areas/${slug}`);

  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search a Dubai area
      </label>
      <div className="card flex items-center gap-3 px-4 py-1.5">
        <Search className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].slug}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Search an area, e.g. Business Bay"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); setOpen(true); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active].slug); }
            else if (e.key === "Escape") setOpen(false);
          }}
          className="h-11 w-full bg-transparent text-[16px] outline-none placeholder:text-ink-muted/80"
        />
      </div>
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="card absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-auto p-1.5">
          {!query.trim() && <li className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted" role="presentation">Most active areas</li>}
          {results.map((a, i) => (
            <li
              key={a.slug}
              id={`${listId}-${a.slug}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(a.slug)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-[#eef1ff]" : ""}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-violet" aria-hidden="true" />
                {a.name}
              </span>
              <span className="text-xs text-ink-muted">{aed(a.median_ppsf)}/sq ft · {a.sales.toLocaleString("en-US")} sales</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { RankItem } from "@/lib/types";

export function RankCard({
  title,
  icon: Icon,
  items,
  value,
  accent,
  note,
}: {
  title: string;
  icon: LucideIcon;
  items: RankItem[];
  value: (i: RankItem) => string;
  accent: string;
  note?: string;
}) {
  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.02em]">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: accent }}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <ol className="mt-3 divide-y divide-ink/5">
        {items.slice(0, 6).map((item, i) => (
          <li key={item.slug}>
            <Link href={`/areas/${item.slug}`} className="group flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="w-5 shrink-0 text-right text-xs font-bold text-ink-muted">{i + 1}</span>
                <span className="truncate font-semibold group-hover:text-violet">{item.name}</span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums">{value(item)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

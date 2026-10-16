import Link from "next/link";
import type { ReactNode } from "react";

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="eyebrow !text-[11px]">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">{value}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-1.5 font-display text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-[-0.03em]">{title}</h2>
      {children && <div className="mt-2 max-w-2xl text-ink-soft">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "brand" }) {
  const tones = {
    neutral: "bg-white text-ink-soft ring-1 ring-ink/10",
    good: "bg-[#e8f7ef] text-good",
    bad: "bg-[#fdeaf0] text-bad",
    brand: "bg-[#efeaff] text-violet",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "primary"
      ? "bg-ink text-white hover:bg-violet"
      : "bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/30";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${cls}`}>
      {children}
    </Link>
  );
}

import Link from "next/link";
import { meta } from "@/lib/data";
import { dateLabel } from "@/lib/format";

export function Footer() {
  return (
    <footer className="border-t border-ink/10 py-10 text-sm text-ink-soft">
      <div className="container-app flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p>
            Built by{" "}
            <a href="https://priyanshu-zihowa.vercel.app" className="font-bold text-ink hover:underline">
              Priyanshu Zihowa
            </a>{" "}
            · Built with Claude Code ·{" "}
            <a href="https://github.com/hellopanda292/dubai-property-intelligence" className="font-bold text-ink hover:underline">
              Source code
            </a>
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Data: Dubai Land Department,{" "}
            <a href="https://dubailand.gov.ae/en/open-data/real-estate-data/" className="underline" target="_blank" rel="noopener noreferrer">
              Real Estate Data
            </a>{" "}
            (open data), {dateLabel(meta.period.from)} to {dateLabel(meta.period.to)}. An independent student project, not
            affiliated with DLD. Figures are statistics of past sales, not valuations or financial advice.
          </p>
        </div>
        <Link href="/about" className="font-semibold text-ink hover:underline">
          How the numbers are made →
        </Link>
      </div>
    </footer>
  );
}

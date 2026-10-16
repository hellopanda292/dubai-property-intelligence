"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Market" },
  { href: "/areas", label: "Areas" },
  { href: "/insights", label: "Insights" },
  { href: "/estimate", label: "Price estimator" },
  { href: "/assistant", label: "AI assistant" },
  { href: "/about", label: "Method" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/70 backdrop-blur-xl">
      <nav aria-label="Main" className="container-app flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.02em]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#2b59ff,#7a4dff_55%,#d63c8f)] text-white">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            Dubai Property <span className="text-gradient">Intelligence</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive(l.href) ? "bg-ink text-white" : "text-ink-soft hover:bg-white hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink ring-1 ring-ink/10 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      {open && (
        <ul id="mobile-nav" className="container-app grid gap-1 pb-4 lg:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`block rounded-xl px-4 py-3 font-semibold ${isActive(l.href) ? "bg-ink text-white" : "bg-white/80 text-ink"}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

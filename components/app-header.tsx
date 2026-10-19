"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { IconButton } from "@/components/ui";

// ─── Shared top bar ──────────────────────────────────────────────────────────
// Brand + page tabs + page-specific actions. On mobile the actions collapse
// into a toggleable panel below the bar.

const MANA = ["#e9dfb8", "#3b8bd0", "#6b6670", "#d9473f", "#2f9a5e"];

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/collection", label: "Collection" },
];

export function ManaPips({ size = 10 }: { size?: number }) {
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {MANA.map((c) => (
        <span key={c} className="rounded-full" style={{ width: size, height: size, background: c }} />
      ))}
    </div>
  );
}

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-7">
        <Link href="/" className="flex items-center gap-3 text-text no-underline">
          <ManaPips />
          <span className="font-serif text-2xl leading-none">Grimoire</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`px-3 sm:px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-surface-hover text-text" : "text-text-muted hover:text-text"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {actions && (
          <>
            <div className="hidden sm:flex ml-auto gap-2">{actions}</div>
            <IconButton
              className="sm:hidden ml-auto border border-border-strong"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </IconButton>
          </>
        )}
      </div>
      {actions && open && (
        <div className="sm:hidden flex flex-col gap-2 px-4 pb-3 [&>button]:w-full [&>button]:justify-start" onClick={() => setOpen(false)}>
          {actions}
        </div>
      )}
    </header>
  );
}

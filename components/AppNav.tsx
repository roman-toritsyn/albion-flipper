"use client";

import { useLocale } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", key: "navBmFlips" as const },
  { href: "/craft", key: "navCraftFlips" as const },
];

export function AppNav() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-6xl gap-1 px-4 pt-4 sm:px-6" aria-label="Main">
      {TABS.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-2 font-[family-name:var(--font-display)] text-sm transition-colors ${
              active
                ? "bg-brass text-[#1a1405]"
                : "border border-border bg-surface text-text-dim hover:text-text"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

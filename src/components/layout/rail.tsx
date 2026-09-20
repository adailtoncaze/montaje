"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { NAV_FOOTER, NAV_ITEMS, type NavItem } from "./nav-items";

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center gap-1 rounded-md text-caption font-semibold",
        "transition-colors duration-100 ease-fluent",
        // mobile: barra inferior · desktop: rail vertical
        "min-w-16 px-2 py-2 md:min-w-0 md:w-[var(--rail-width)] md:rounded-none md:px-0 md:py-3",
        active
          ? "bg-rail-active text-rail-fg"
          : "text-rail-fg-muted hover:bg-rail-hover hover:text-rail-fg",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 hidden h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-rail-indicator md:block"
        />
      )}
      <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
      <span>{item.label}</span>
    </Link>
  );
}

export function Rail({ isAdmin = true }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const footer = NAV_FOOTER.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed z-20 bg-rail",
        // mobile
        "inset-x-0 bottom-0 flex items-center gap-1 overflow-x-auto px-2 pt-1",
        "pb-[max(0.25rem,env(safe-area-inset-bottom))]",
        // desktop
        "md:inset-y-0 md:left-0 md:right-auto md:w-(--rail-width) md:flex-col md:overflow-visible md:px-0 md:py-3",
      )}
    >
      <div
        aria-hidden
        className="mb-3 hidden size-9 items-center justify-center rounded-lg bg-rail-logo text-rail-fg md:flex"
      >
        <Logo className="size-7" />
      </div>

      <div className="flex items-center gap-1 md:flex-col md:items-center">
        {NAV_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="flex items-center gap-1 md:mt-auto md:flex-col">
        {footer.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}

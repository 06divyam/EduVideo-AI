"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import {
  BookOpenIcon,
  DashboardIcon,
  LogoIcon,
  PlusCircleIcon,
  QuizIcon,
  SettingsIcon,
  VideoIcon,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const mainNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/create", label: "Create video", icon: PlusCircleIcon },
  { href: "/study", label: "Study notes", icon: BookOpenIcon },
  { href: "/quiz", label: "Quizzes", icon: QuizIcon },
  { href: "/videos", label: "My videos", icon: VideoIcon },
];

const secondaryNavItems: NavItem[] = [
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(pathname: string | null, href: string) {
  if (pathname === null) {
    return false;
  }
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
        <LogoIcon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-slate-900">
        EduVideo AI
      </span>
    </Link>
  );
}

type NavLinksProps = {
  items: NavItem[];
  compact?: boolean;
};

// usePathname() reads URL data, which must sit inside <Suspense> under
// cacheComponents. The fallback renders the same links without an active
// highlight so navigation is available in the static shell.
function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavLinksProps) {
  const pathname = usePathname();
  return <NavList {...props} pathname={pathname} />;
}

function NavList({
  items,
  compact = false,
  pathname,
}: NavLinksProps & { pathname: string | null }) {
  return (
    <nav
      aria-label={compact ? "Mobile navigation" : "Main navigation"}
      className={
        compact
          ? "flex items-center gap-1 overflow-x-auto"
          : "flex flex-col gap-1"
      }
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex items-center gap-2.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              compact ? "whitespace-nowrap px-2.5 py-1.5" : "px-2.5 py-1.5",
              active
                ? "bg-slate-100 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            <Icon
              className={`h-4 w-4 ${active ? "text-brand-600" : "text-slate-400"}`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-4 lg:flex">
        <div className="px-2.5">
          <Brand />
        </div>

        <Link href="/create" className="btn-primary mx-1 mt-5">
          <PlusCircleIcon className="h-4 w-4" />
          New video
        </Link>

        <div className="mt-5">
          <NavLinks items={mainNavItems} />
        </div>

        <div className="mt-auto border-t border-slate-200 pt-3">
          <NavLinks items={secondaryNavItems} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Brand />
          <Link href="/create" className="btn-primary px-3 py-1.5 text-xs">
            <PlusCircleIcon className="h-4 w-4" />
            New video
          </Link>
        </div>
        <div className="px-2 pb-2">
          <NavLinks items={[...mainNavItems, ...secondaryNavItems]} compact />
        </div>
      </header>
    </>
  );
}

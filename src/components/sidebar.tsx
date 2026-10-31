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
  { href: "/create", label: "Create Video", icon: PlusCircleIcon },
  { href: "/study", label: "Study Notes", icon: BookOpenIcon },
  { href: "/quiz", label: "Quizzes", icon: QuizIcon },
  { href: "/videos", label: "My Videos", icon: VideoIcon },
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
    <Link href="/" className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40">
        <LogoIcon className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-white">
          EduVideo AI
        </span>
        <span className="block text-xs text-slate-400">
          Turn notes into knowledge
        </span>
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
              "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
              compact ? "whitespace-nowrap px-3 py-2" : "px-3 py-2.5",
              active
                ? "bg-white/10 text-white ring-1 ring-inset ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            {active && !compact ? (
              <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
            ) : null}
            <Icon
              className={`h-[18px] w-[18px] ${
                active
                  ? "text-indigo-300"
                  : "text-slate-500 group-hover:text-slate-300"
              }`}
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto border-r border-white/10 bg-[#0b1226] px-5 py-6 lg:flex">
        <Brand />

        <Link
          href="/create"
          className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1226]"
        >
          <PlusCircleIcon className="h-[18px] w-[18px]" />
          New video
        </Link>

        <p className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Workspace
        </p>
        <div className="mt-2">
          <NavLinks items={mainNavItems} />
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <NavLinks items={secondaryNavItems} />
        </div>

        <div className="mt-auto rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
          <p className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Education track
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Turn a PDF into study notes, a timed quiz, and a narrated lesson.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1226]/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <Link
            href="/create"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-xs font-semibold text-white"
          >
            <PlusCircleIcon className="h-4 w-4" />
            New
          </Link>
        </div>
        <div className="px-2 pb-2">
          <NavLinks items={[...mainNavItems, ...secondaryNavItems]} compact />
        </div>
      </header>
    </>
  );
}

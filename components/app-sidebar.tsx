"use client";

import { Home, CreditCard, BedDouble, CalendarDays, LogOut } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { MarkLockup } from "@/components/plan/district-mark";
import { StateBadge } from "@/components/plan/state";
import { dutyLabel } from "@/lib/duties";
import { event } from "@/lib/event";

const navItems = [
  { title: "Kaydınız", short: "Kayıt", url: "/", icon: Home },
  { title: "Ödemeler", short: "Ödeme", url: "/odemeler", icon: CreditCard },
  { title: "Oda planlama", short: "Oda", url: "/oda-planlama", icon: BedDouble },
  { title: "Takvim", short: "Takvim", url: "/takvim", icon: CalendarDays },
];

interface AppSidebarProps {
  profile: {
    first_name: string | null;
    last_name: string | null;
    gorev: string | null;
    status: string | null;
  } | null;
  signOutAction: () => Promise<void>;
}

/**
 * The title block.
 *
 * A drawing set carries one in the corner of every sheet: whose it is, what it
 * covers, what state it is in. That is precisely what this panel holds about a
 * registrant, so the shell is drawn as one rather than as a generic app rail —
 * fields first, navigation under them, all on poché.
 *
 * The active page is filled with paper, the inverse of the poché'd row in a
 * picker: the same rule either way round — filled means "this is the current
 * one".
 */
export function AppSidebar({ profile, signOutAction }: AppSidebarProps) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const gorev = dutyLabel(profile?.gorev);

  return (
    <>
      <aside className="ink-ground poche-ruled sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-ink md:flex">
        <div className="px-5 pt-6">
          <a href={event.siteUrl} target="_blank" rel="noopener noreferrer">
            <MarkLockup ground="ink" />
          </a>
        </div>

        <div className="mt-6 px-5">
          <div className="tb-field">
            <p className="tb-label">Kayıt sahibi</p>
            <p className="tb-value">{name || "—"}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Görev</p>
            <p className="tb-value">{gorev ?? "Seçilmedi"}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Durum</p>
            <p className="mt-1.5">
              <StateBadge status={profile?.status ?? null} />
            </p>
          </div>
        </div>

        <nav aria-label="Panel" className="mt-7 flex-1 px-5">
          <ul>
            {navItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  href={item.url}
                  className="t-label flex items-center gap-3 border-b border-paper/15 px-2.5 py-2.5 text-[0.875rem] text-paper/80 transition-colors hover:text-paper"
                  activeClassName="!bg-paper !text-ink"
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-5 pb-6">
          <form action={signOutAction}>
            <button type="submit" className="btn btn-secondary w-full">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Çıkış yap
            </button>
          </form>
        </div>
      </aside>

      {/* On a phone the block collapses to a strip, and the pages get the width. */}
      <div className="ink-ground poche sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 md:hidden">
        <a href={event.siteUrl} target="_blank" rel="noopener noreferrer">
          <MarkLockup ground="ink" />
        </a>
        <div className="min-w-0 text-right">
          <p className="t-label truncate text-[0.8125rem]">{name || "—"}</p>
          <p className="t-data truncate text-[0.625rem] text-paper/60">
            {gorev ?? "Görev seçilmedi"}
          </p>
        </div>
      </div>

      <nav
        aria-label="Panel"
        className="ink-ground poche fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-paper/25 md:hidden"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            href={item.url}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-paper/70 transition-colors"
            activeClassName="!bg-paper !text-ink"
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span className="t-note text-[0.5625rem]">{item.short}</span>
          </NavLink>
        ))}
        <form action={signOutAction} className="flex min-w-0 flex-1">
          <button
            type="submit"
            className="flex w-full flex-col items-center gap-1 px-1 py-2 text-paper/70"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="t-note text-[0.5625rem]">Çıkış</span>
          </button>
        </form>
      </nav>
    </>
  );
}

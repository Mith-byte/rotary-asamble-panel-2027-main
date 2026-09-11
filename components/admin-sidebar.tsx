"use client";

import { Users, FileCheck, BedDouble, LogOut } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { MarkLockup } from "@/components/plan/district-mark";
import { event } from "@/lib/event";

const navItems = [
  { title: "Kayıtlar", short: "Kayıt", url: "/kullanicilar", icon: Users },
  { title: "Dekontlar", short: "Dekont", url: "/dekontlar", icon: FileCheck },
  { title: "Odalar", short: "Oda", url: "/odalar", icon: BedDouble },
];

interface AdminSidebarProps {
  profile: { first_name: string | null; last_name: string | null } | null;
  signOutAction: () => Promise<void>;
}

/** The same title block the registrant sees, filled in for district staff. */
export function AdminSidebar({ profile, signOutAction }: AdminSidebarProps) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <>
      <aside className="ink-ground poche-ruled sticky top-0 z-10 hidden h-screen w-64 shrink-0 flex-col border-r border-ink md:flex">
        <div className="px-5 pt-6">
          <MarkLockup ground="ink" />
        </div>

        <div className="mt-6 px-5">
          <div className="tb-field">
            <p className="tb-label">Kullanıcı</p>
            <p className="tb-value">{name || "—"}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Yetki</p>
            <p className="tb-value">Bölge görevlisi</p>
          </div>
        </div>

        <nav aria-label="Yönetim" className="mt-7 flex-1 px-5">
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

      <div className="ink-ground poche sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 md:hidden">
        <MarkLockup ground="ink" />
        <p className="t-label truncate text-[0.8125rem]">{name || "—"}</p>
      </div>

      <nav
        aria-label="Yönetim"
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

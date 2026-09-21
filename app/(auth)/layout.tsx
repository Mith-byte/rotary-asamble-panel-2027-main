import { ReactNode } from "react";
import { MarkLockup } from "@/components/plan/district-mark";
import { event } from "@/lib/event";

/**
 * The signed-out shell is one sheet with its title block attached.
 *
 * A drawing's title block states what sheet you are holding before you read
 * anything on it — district, term, dates, venue. That is exactly what someone
 * arriving from the public site needs confirmed, so it is drawn as one: poché,
 * fixed to the left, with the form on the paper beside it.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[22rem_1fr]">
      <aside className="ink-ground poche-ruled flex flex-col gap-7 px-6 py-7 lg:sticky lg:top-0 lg:h-screen lg:px-8 lg:py-9">
        <a
          href={event.siteUrl}
          className="inline-block"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MarkLockup ground="ink" />
        </a>

        <div className="hidden lg:block">
          <div className="tb-field">
            <p className="tb-label">Etkinlik</p>
            <p className="tb-value">{event.name}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Dönem</p>
            <p className="tb-value t-data">{event.term}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Tarih</p>
            <p className="tb-value t-data">{event.dateLabel}</p>
          </div>
          <div className="tb-field">
            <p className="tb-label">Tesis</p>
            <p className="tb-value">{event.venue}</p>
            <p className="t-data mt-0.5 text-xs text-paper/55">{event.venueCity}</p>
          </div>
        </div>

        {/* The block's fields do not fit beside a phone-width form, but the
            registrant still needs the event confirmed — so the three that
            answer "am I in the right place" stay, run as a strip. */}
        <dl className="flex flex-wrap gap-x-5 gap-y-1.5 lg:hidden">
          <div>
            <dt className="tb-label">Tarih</dt>
            <dd className="t-data text-[0.8125rem]">{event.dateLabel}</dd>
          </div>
          <div>
            <dt className="tb-label">Tesis</dt>
            <dd className="t-data text-[0.8125rem]">{event.venue}</dd>
          </div>
        </dl>

        <p className="t-note mt-auto text-paper/55">{event.district}</p>
      </aside>

      <main className="flex items-start justify-center px-5 py-9 md:px-8 md:py-14">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}

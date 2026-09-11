import type { ReactNode } from "react";

/**
 * A room: the default container. An opaque panel walled the way a plan draws a
 * wall — two hairlines with a gap. Forms and tables go in rooms; prose sits
 * directly on the gridded paper.
 */
export function Room({
  children,
  className = "",
  frameClassName = "",
  draft = false,
}: {
  children: ReactNode;
  /**
   * Padding and layout for the CONTENT, applied inside the wall. It must not
   * go on the frame: `.room` draws its second line with an inset ring, so a
   * padding utility on the frame collapses the gap and the content lands on
   * the wall.
   */
  className?: string;
  /** Layout for the frame itself — margins, width, grid placement. */
  frameClassName?: string;
  /** Draws the room as work not yet issued: dashed, hatched. */
  draft?: boolean;
}) {
  return (
    <div className={`room ${frameClassName}`} {...(draft ? { "data-draft": "" } : {})}>
      <div className={`${draft ? "draft-ground " : ""}${className}`}>{children}</div>
    </div>
  );
}

/**
 * A room tag. On a plan every room carries one: its name over its area, boxed
 * and set in annotation lettering.
 *
 * `figure` is the area — and it must be a REAL count of what the room holds
 * ("26 GÖREV", "9 PAKET", "3 TAKSİT"). A decorative 01 / 02 / 03 is not a room
 * tag, it is a sticker.
 */
export function RoomTag({ name, figure }: { name: string; figure?: string }) {
  return (
    <span className="inline-flex items-stretch border border-ink">
      <span className="t-note px-2.5 py-1.5">{name}</span>
      {figure && (
        <span className="t-data border-l border-ink px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground">
          {figure}
        </span>
      )}
    </span>
  );
}

/** A page head: the room tag, the title, and one line of orientation. */
export function PageHead({
  tag,
  figure,
  title,
  lead,
  children,
}: {
  tag: string;
  figure?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 md:mb-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoomTag name={tag} figure={figure} />
        {children}
      </div>
      <h1 className="t-sheet mt-4" style={{ fontSize: "var(--h-sheet)" }}>
        {title}
      </h1>
      {lead && (
        <p className="prose-measure mt-3 text-[0.975rem] text-muted-foreground">
          {lead}
        </p>
      )}
    </header>
  );
}

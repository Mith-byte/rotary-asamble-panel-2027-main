import type { ReactNode } from "react";

/** Label left, value right, hairline between — what a schedule looks like. */
export function Register({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`register ${className}`}>{children}</dl>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * A title-block field: label above value. Used where the value is the thing
 * being read (a record), rather than beside it (a schedule).
 */
export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="t-note text-muted-foreground">{label}</p>
      <p className="t-label mt-1 text-[0.9375rem]">{children}</p>
    </div>
  );
}

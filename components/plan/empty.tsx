import type { ReactNode } from "react";

/**
 * An empty screen is an invitation to act, not a mood. It says what is not
 * there and what to do about it — never "henüz bir şey yok" on its own.
 */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="draft-ground border border-dashed border-ink/45 px-5 py-9 text-center">
      <p className="t-label text-[0.9375rem]">{title}</p>
      {children && (
        <p className="prose-measure mx-auto mt-2 text-sm text-muted-foreground">{children}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

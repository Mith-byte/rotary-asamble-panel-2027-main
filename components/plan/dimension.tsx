/**
 * A dimension line: annotates something genuinely measured — days remaining,
 * instalments paid of the total, places taken of capacity.
 *
 * Never a divider. If it is not measuring a quantity, it is the wrong device.
 */
export function Dimension({
  label,
  value,
  total,
  figure,
}: {
  label: string;
  value: number;
  total: number;
  /** What the measurement reads, e.g. "2 / 3" or "148 gün". */
  figure: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="t-note text-muted-foreground">{label}</p>
        <p className="t-data text-[0.8125rem]">{figure}</p>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="dim-tick h-2.5" aria-hidden="true" />
        <span className="dim-arrow dim-arrow-l" aria-hidden="true" />
        <span className="dim-track relative flex-1" aria-hidden="true">
          <span className="dim-fill absolute inset-y-0 left-0" style={{ width: `${pct}%` }} />
        </span>
        <span className="dim-arrow dim-arrow-r" aria-hidden="true" />
        <span className="dim-tick h-2.5" aria-hidden="true" />
      </div>
    </div>
  );
}

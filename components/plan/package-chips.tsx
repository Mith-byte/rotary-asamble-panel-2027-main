/**
 * The three axes a package is made of, always drawn as three slots.
 *
 * Three of the nine packages are named for what they LEAVE OUT, so a summary
 * that lists only inclusions makes "Tören • Konaklama ve Gala Hariç" and
 * "Gala + Tören • Konaklama Hariç" look identical until you read the name
 * closely. Every slot is drawn; a missing one is drawn as a void — dashed,
 * unhatched — and says so in words.
 */
export interface PackageAxes {
  nights: number;
  capacity: number | null;
  ceremony: boolean;
  gala: boolean;
}

export function PackageChips({ pkg }: { pkg: PackageAxes }) {
  const stay = pkg.nights > 0;
  return (
    <ul className="flex flex-wrap gap-1.5">
      <li>
        <span className="chip t-note" data-code="stay" {...(stay ? {} : { "data-void": "" })}>
          <span className="swatch" aria-hidden="true" />
          {stay
            ? `${pkg.nights} gece${pkg.capacity && pkg.capacity > 1 ? ` · ${pkg.capacity} kişi` : ""}`
            : "Konaklama yok"}
        </span>
      </li>
      <li>
        <span className="chip t-note" data-code="rite" {...(pkg.ceremony ? {} : { "data-void": "" })}>
          <span className="swatch" aria-hidden="true" />
          {pkg.ceremony ? "Tören" : "Tören yok"}
        </span>
      </li>
      <li>
        <span className="chip t-note" data-code="gala" {...(pkg.gala ? {} : { "data-void": "" })}>
          <span className="swatch" aria-hidden="true" />
          {pkg.gala ? "Gala" : "Gala yok"}
        </span>
      </li>
    </ul>
  );
}

/**
 * No package carries a figure yet. Rather than print an empty price or invent
 * one, the slot is drawn as work not yet issued — which is what it is.
 */
export function PriceNotIssued({ className = "" }: { className?: string }) {
  return (
    <span className={`stamp t-note ${className}`}>Ücret açıklanmadı</span>
  );
}

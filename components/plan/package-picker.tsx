"use client";

import { PackageChips, PriceNotIssued, type PackageAxes } from "./package-chips";

export interface PackageRow extends PackageAxes {
  id: string;
  name: string;
  group: string;
  early_bird_price: number | null;
  early_bird_installment_price: number | null;
  round_1_price: number | null;
  round_1_installment_price: number | null;
  round_2_price: number | null;
  round_2_installment_price: number | null;
}

export type PricingType = "early_bird" | "round_1" | "round_2";

const eur = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function packagePrice(pkg: PackageRow, pricing: PricingType): number | null {
  return pkg[`${pricing}_price` as const];
}

export function formatPrice(value: number | null): string | null {
  return value == null ? null : eur.format(value);
}

/**
 * The paket picker. One package per registration, so it is a radio group for
 * the same reasons the görev picker is.
 *
 * Every package draws all three axes, including the ones it does not carry —
 * three of the nine are named for what they leave out, and a summary of
 * inclusions alone makes those three indistinguishable at a glance.
 *
 * No package has a price yet. A priceless package is drawn as work not yet
 * issued rather than shown with a blank or an invented figure.
 */
export function PackagePicker({
  packages,
  value,
  onChange,
  pricing,
  name = "paket",
}: {
  packages: PackageRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  pricing: PricingType;
  name?: string;
}) {
  const konaklamali = packages.filter((p) => p.group === "konaklamalı");
  const konaklamasiz = packages.filter((p) => p.group !== "konaklamalı");

  return (
    <fieldset>
      <legend className="sr-only">Paket</legend>

      {value && (
        <div className="mb-4 flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
            Seçimi kaldır
          </button>
        </div>
      )}

      <div className="space-y-6">
        <PackageGroup
          title="Konaklamalı"
          note="Tesiste konaklama dahil. Kişi sayısı odanın kapasitesidir."
          rows={konaklamali}
          {...{ name, value, onChange, pricing }}
        />
        <PackageGroup
          title="Konaklamasız"
          note="Konaklama yok. Yalnızca adı geçen etkinlikleri kapsar."
          rows={konaklamasiz}
          {...{ name, value, onChange, pricing }}
        />
      </div>
    </fieldset>
  );
}

function PackageGroup({
  title,
  note,
  rows,
  name,
  value,
  onChange,
  pricing,
}: {
  title: string;
  note: string;
  rows: PackageRow[];
  name: string;
  value: string | null;
  onChange: (id: string) => void;
  pricing: PricingType;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-ink pb-1.5">
        <h3 className="t-sheet text-[0.8125rem]">{title}</h3>
        <p className="t-data text-[0.6875rem] text-muted-foreground">{rows.length} paket</p>
      </div>
      <p className="mb-2 text-[0.8125rem] text-muted-foreground">{note}</p>
      <ul className="space-y-1.5">
        {rows.map((pkg) => {
          const checked = value === pkg.id;
          const price = formatPrice(packagePrice(pkg, pricing));
          return (
            <li key={pkg.id}>
              <label
                className="pick flex cursor-pointer flex-col gap-2.5 border border-rule px-3 py-3"
                data-pick={checked ? "true" : undefined}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={name}
                    value={pkg.id}
                    checked={checked}
                    onChange={() => onChange(pkg.id)}
                    className="sr-only"
                  />
                  <span className="mark" aria-hidden="true" />
                  <span className="t-label text-[0.9375rem]">{pkg.name}</span>
                  <span className="ml-auto shrink-0">
                    {price ? (
                      <span className="t-data text-[0.9375rem]">{price}</span>
                    ) : (
                      <PriceNotIssued />
                    )}
                  </span>
                </span>
                <PackageChips pkg={pkg} />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

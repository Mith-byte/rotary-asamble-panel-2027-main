"use client";

import { useId, useMemo, useState } from "react";
import { DUTIES, DUTY_GROUPS, type Duty } from "@/lib/duties";

/**
 * The görev picker.
 *
 * 26 duties in the district's own five groups, in the district's own order.
 * You hold exactly one, so this is a real radio group — one fieldset, 26
 * inputs sharing a name, visually hidden and styled through their labels. That
 * buys arrow-key traversal and "1 of 26" from the platform; a set of divs with
 * aria-pressed would buy neither.
 *
 * The picked row is poché'd and its bubble is gold: filled because it is the
 * current one, gold because it is yours. Radios cannot be unchecked by
 * clicking again, so "Seçimi kaldır" is offered explicitly.
 */
export function DutyPicker({
  value,
  onChange,
  name = "gorev",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  name?: string;
}) {
  const [query, setQuery] = useState("");
  const fieldId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return DUTIES;
    return DUTIES.filter(
      (d) =>
        d.label.toLocaleLowerCase("tr").includes(q) ||
        (d.term ?? "").toLocaleLowerCase("tr").includes(q),
    );
  }, [query]);

  const byGroup = (g: string) => matches.filter((d) => d.group === g);

  return (
    <fieldset>
      <legend className="sr-only">Görev</legend>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <label htmlFor={`${fieldId}-filter`} className="field-label">
            Görev ara
          </label>
          <input
            id={`${fieldId}-filter`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sekreter, guvernör, Rotaractör…"
            className="field-input"
          />
        </div>
        {value && (
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
            Seçimi kaldır
          </button>
        )}
      </div>

      <p aria-live="polite" className="t-note mb-3 text-muted-foreground">
        {matches.length} görev listeleniyor
      </p>

      {matches.length === 0 ? (
        <div className="draft-ground border border-dashed border-ink/45 px-4 py-7 text-center">
          <p className="t-label text-[0.9375rem]">Bu aramaya uyan görev yok</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Göreviniz listede değilse en yakınını seçin: komite başkanları için
            Komite Başkanı, görevi olmayan üyeler için Üye, Rotaryen olmayanlar
            için Misafir.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {DUTY_GROUPS.map((group) => {
            const rows = byGroup(group.id);
            if (rows.length === 0) return null;
            return (
              <section key={group.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-ink pb-1.5">
                  <h3 className="t-sheet text-[0.8125rem]">{group.label}</h3>
                  <p className="t-data text-[0.6875rem] text-muted-foreground">
                    {rows.length} görev
                  </p>
                </div>
                <p className="mb-2 text-[0.8125rem] text-muted-foreground">{group.note}</p>
                <ul>
                  {rows.map((duty) => (
                    <DutyRow
                      key={duty.id}
                      duty={duty}
                      name={name}
                      checked={value === duty.id}
                      onChange={onChange}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function DutyRow({
  duty,
  name,
  checked,
  onChange,
}: {
  duty: Duty;
  name: string;
  checked: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <li>
      <label
        className="pick flex cursor-pointer items-center gap-3 border-b border-rule px-2.5 py-2.5"
        data-pick={checked ? "true" : undefined}
      >
        <input
          type="radio"
          name={name}
          value={duty.id}
          checked={checked}
          onChange={() => onChange(duty.id)}
          className="sr-only"
        />
        <span className="mark" aria-hidden="true" />
        <span className="t-label text-[0.9375rem]">{duty.label}</span>
        {duty.term && (
          <span className="pick-muted t-data ml-auto shrink-0 text-[0.6875rem] text-muted-foreground">
            {duty.term}
          </span>
        )}
      </label>
    </li>
  );
}

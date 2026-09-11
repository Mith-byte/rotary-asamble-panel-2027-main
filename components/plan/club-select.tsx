"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clubsForDutyGroup, type Club } from "@/lib/clubs";
import { getDuty } from "@/lib/duties";

/**
 * Kulüp.
 *
 * The roster shown follows the görev: a Rotaractör sees Rotaract clubs, a club
 * or district officer sees Rotary clubs, an Interactör sees Interact clubs,
 * and a Misafir — who attends without a post — sees all three. Filtering here
 * is not a convenience; it is what keeps the field answerable, since the same
 * name exists in more than one body.
 */
export function ClubSelect({
  value,
  onChange,
  error,
  gorev,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
  /** The görev chosen alongside this club; decides which roster is offered. */
  gorev?: string | null;
}) {
  const dutyGroup = getDuty(gorev)?.group ?? null;
  const roster = useMemo(() => clubsForDutyGroup(dutyGroup), [dutyGroup]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const filtered = useMemo<Club[]>(() => {
    const q = search.toLocaleLowerCase("tr");
    return roster.filter((c) => c.full.toLocaleLowerCase("tr").includes(q));
  }, [search, roster]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef}>
      <label htmlFor={id} className="field-label">
        Kulüp
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Kulübünüzü arayın"
          value={open ? search : value}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          aria-invalid={error ? true : undefined}
          className="field-input"
        />
        {open && (
          <div
            id={`${id}-list`}
            role="listbox"
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border border-ink bg-sheet"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                Bu aramaya uyan kulüp yok. Göreviniz {rosterLabel(dutyGroup)}{" "}
                listesini açar — göreviniz farklı bir kulüpteyse önce görevinizi
                değiştirin.
              </p>
            ) : (
              filtered.map((club) => (
                <button
                  key={club.full}
                  type="button"
                  role="option"
                  aria-selected={club.full === value}
                  onClick={() => {
                    onChange(club.full);
                    setSearch("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0 ${
                    club.full === value ? "bg-ink text-paper" : "hover:bg-ink/8"
                  }`}
                >
                  <span className="flex-1 text-sm">{club.full}</span>
                  {club.group !== undefined && (
                    <span
                      className={`t-data shrink-0 text-[0.6875rem] ${
                        club.full === value ? "text-paper/65" : "text-muted-foreground"
                      }`}
                    >
                      {club.group}. grup
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error ? (
        <p className="field-error mt-2">{error}</p>
      ) : (
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">
          Göreviniz {rosterLabel(dutyGroup)} listesini açtı · {roster.length} kulüp
        </p>
      )}
    </div>
  );
}

function rosterLabel(dutyGroup: string | null): string {
  if (dutyGroup === "rotaract") return "Rotaract kulüpleri";
  if (dutyGroup === "interact") return "Interact kulüpleri";
  if (dutyGroup === "misafir" || dutyGroup === null) return "tüm kulüpler";
  return "Rotary kulüpleri";
}

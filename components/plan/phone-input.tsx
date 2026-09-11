"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, type Country } from "@/lib/countries";

/** Telefon. Country dial code and the number, drawn as one ruled field. */
export function PhoneInput({
  value,
  onChange,
  selectedCountry,
  onCountryChange,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  selectedCountry: Country;
  onCountryChange: (country: Country) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")) ||
      c.dial.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

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
        Telefon
      </label>
      <div className="relative">
        <div className="field-group">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Ülke kodu: ${selectedCountry.name} ${selectedCountry.dial}`}
            onClick={() => {
              setOpen(!open);
              setSearch("");
            }}
            className="field-addon"
          >
            <span className="text-base leading-none" aria-hidden="true">
              {selectedCountry.flag}
            </span>
            <span className="t-data text-sm">{selectedCountry.dial}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="5551234567"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
            aria-invalid={error ? true : undefined}
            className="field-input t-data min-w-0 flex-1"
          />
        </div>
        {open && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 border border-ink bg-sheet">
            <div className="border-b border-rule p-2">
              <input
                type="text"
                placeholder="Ülke arayın"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">
                  Bu aramaya uyan ülke yok.
                </p>
              ) : (
                filtered.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      onCountryChange(country);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0 ${
                      country.code === selectedCountry.code
                        ? "bg-ink text-paper"
                        : "hover:bg-ink/8"
                    }`}
                  >
                    <span className="text-base leading-none">{country.flag}</span>
                    <span className="flex-1 text-sm">{country.name}</span>
                    <span
                      className={`t-data text-xs ${
                        country.code === selectedCountry.code
                          ? "text-paper/65"
                          : "text-muted-foreground"
                      }`}
                    >
                      {country.dial}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="field-error mt-2">{error}</p>}
    </div>
  );
}

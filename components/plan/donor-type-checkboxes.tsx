"use client";

import { DONOR_TYPES, type DonorType } from "@/types/registration";

interface DonorTypeCheckboxesProps {
  selected?: string[];
  onChange: (types: string[]) => void;
  idPrefix?: string;
  label?: string;
}

export function DonorTypeCheckboxes({
  selected = [],
  onChange,
  idPrefix = "donor",
  label = "Bağışçı Türü",
}: DonorTypeCheckboxesProps) {
  const toggle = (type: string) => {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1.5">
        <label className="field-label !mb-0 font-medium text-ink">
          {label}
        </label>
        <span className="text-xs text-muted-foreground font-normal">
          (Varsa — Birden fazla seçebilirsiniz)
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1.5">
        {DONOR_TYPES.map((type) => {
          const checked = selected.includes(type);
          const inputId = `${idPrefix}_${type.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          return (
            <label
              key={type}
              htmlFor={inputId}
              className={`flex items-center gap-2 cursor-pointer text-sm select-none px-2.5 py-1.5 border transition-all ${
                checked
                  ? "border-ink bg-ink/5 font-medium text-ink shadow-sm"
                  : "border-rule text-muted-foreground hover:text-ink hover:border-ink/40 bg-paper"
              }`}
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(type)}
                className="w-4 h-4 rounded border-rule text-ink focus:ring-ink"
              />
              <span>{type}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

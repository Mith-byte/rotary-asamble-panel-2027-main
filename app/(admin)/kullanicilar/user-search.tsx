"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";

export function UserSearch({ currentQuery }: { currentQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  function updateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={currentQuery}
        placeholder="İsme göre ara..."
        onChange={(e) => updateSearch(e.target.value)}
        className="field-input w-full py-1.5 pl-8 pr-8 text-sm sm:w-64"
      />
      {currentQuery && (
        <button
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            updateSearch("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
}

interface AdminListControlsProps {
  filterOptions: FilterOption[];
  currentStatus: string;
  currentPage: number;
  totalPages: number;
  showFilters?: boolean;
}

export function AdminListControls({
  filterOptions,
  currentStatus,
  currentPage,
  totalPages,
  showFilters = true,
}: AdminListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (
          value === "" ||
          (key === "status" && value === "all") ||
          (key === "page" && value === "1")
        ) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      }
      const qs = newParams.toString();
      return pathname + (qs ? `?${qs}` : "");
    },
    [pathname, searchParams]
  );

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="t-note text-muted-foreground mr-1">
            Filtre:
          </span>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                router.push(createUrl({ status: option.value, page: "1" }), {
                  scroll: false,
                })
              }
              className={cn(
                "px-3 py-1.5 t-note transition-all duration-200 border",
                currentStatus === option.value
                  ? "border-ink  text-ink"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="xs"
            disabled={currentPage <= 1}
            onClick={() =>
              router.push(createUrl({ page: String(currentPage - 1) }), {
                scroll: false,
              })
            }
            className="t-note gap-1 border-ink"
          >
            <ChevronLeft className="w-3 h-3" />
            Önceki
          </Button>
          <span className="t-note text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={currentPage >= totalPages}
            onClick={() =>
              router.push(createUrl({ page: String(currentPage + 1) }), {
                scroll: false,
              })
            }
            className="t-note gap-1 border-ink"
          >
            Sonraki
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

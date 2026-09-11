"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsv() {
  return (
    <Button
      size="xs"
      variant="outline"
      className="gap-1.5 t-note"
      onClick={() => {
        window.location.href = "/api/export-csv";
      }}
    >
      <Download className="w-3 h-3" />
      CSV İndir
    </Button>
  );
}

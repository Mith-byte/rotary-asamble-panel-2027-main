"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportRoomsCsv() {
  return (
    <Button
      size="xs"
      variant="outline"
      className="gap-1.5 t-note hover:bg-ink hover:text-paper transition-colors"
      onClick={() => {
        window.location.href = "/api/export-rooms-csv";
      }}
      title="Acenteye iletilmek üzere detaylı oda dağılım ve eşleştirme raporunu (CSV) indir"
    >
      <Download className="w-3 h-3" />
      ODA RAPORU İNDİR (CSV)
    </Button>
  );
}

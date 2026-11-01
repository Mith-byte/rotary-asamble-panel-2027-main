"use client";

import { useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { formatEuro } from "@/lib/pricing";

interface PayButtonProps {
  amount: number;
}

export function PayButton({ amount }: PayButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <form
      action="/api/payment/init"
      method="POST"
      onSubmit={() => {
        setLoading(true);
      }}
      className="space-y-3"
    >
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {loading ? "Ödeme Sayfasına Aktarılıyor…" : `${formatEuro(amount)} — Kredi Kartı ile Öde`}
      </button>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>İş Bankası 3D Secure 256-bit SSL korumalı güvenli ödeme</span>
      </div>
    </form>
  );
}

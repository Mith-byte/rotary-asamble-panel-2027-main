"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

interface PayButtonProps {
  amount: number;
}

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export function PayButton({ amount }: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/initiate", { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Ödeme başlatılamadı. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      // Sanal POS sayfasına yönlendir (yeni sekmede)
      window.open(data.redirect_url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {loading ? "Yönlendiriliyor…" : `${tl.format(amount)} — Kredi Kartı ile Öde`}
      </button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

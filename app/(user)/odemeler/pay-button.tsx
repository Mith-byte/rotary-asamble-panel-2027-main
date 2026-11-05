"use client";

import { useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { formatEuro } from "@/lib/pricing";

interface PayButtonProps {
  amount: number;
}

export function PayButton({ amount }: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.paymentUrl) {
        setError(data.error || "Ödeme başlatılamadı. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      // İş Bankası'nın güncel 'İş'le Öde' ödeme sayfasına yönlendir
      window.location.href = data.paymentUrl;
    } catch (err: any) {
      console.error("[PayButton] Ödeme başlatma hatası:", err);
      setError("Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handlePay}
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

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>İş Bankası 'İş'le Öde' 256-bit SSL korumalı güvenli ödeme</span>
      </div>
    </div>
  );
}

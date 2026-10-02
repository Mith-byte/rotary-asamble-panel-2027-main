"use client";

import { useState, useEffect, useCallback } from "react";

const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;

interface OtpVerificationProps {
  email: string;
  onVerify: (otp: string) => Promise<string | null>;
  onResend: () => Promise<{ success: boolean; remainingSeconds?: number }>;
  onBack: () => void;
}

export function OtpVerification({
  email,
  onVerify,
  onResend,
  onBack,
}: OtpVerificationProps) {
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (expirySeconds <= 0) return;
    const id = setInterval(() => setExpirySeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [expirySeconds > 0]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown > 0]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const expired = expirySeconds <= 0;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    if (expired) {
      setError("Kod süresi doldu, lütfen yeni kod gönderin");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const err = await onVerify(otp);
      if (err) {
        setError(err);
        setIsLoading(false);
      }
      // If no error, we do not reset isLoading so the button stays disabled during redirect
    } catch (err: any) {
      setError(err.message || "Bilinmeyen bir hata oluştu");
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    const result = await onResend();
    if (result.success) {
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setOtp("");
    } else if (result.remainingSeconds) {
      setResendCooldown(result.remainingSeconds);
    }
    setResending(false);
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div>
        <label htmlFor="otp" className="field-label">
          Doğrulama kodu
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="12345678"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby="otp-help"
          className="field-input t-data tracking-[0.3em]"
        />
        <p id="otp-help" className="mt-2 text-[0.8125rem] text-muted-foreground">
          {email} adresine gönderdiğimiz sekiz haneli kodu girin.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="t-data text-[0.8125rem]" aria-live="polite">
          {expired ? "Kodun süresi doldu" : `Kalan süre ${formatTime(expirySeconds)}`}
        </p>
        <button
          type="button"
          className="t-note text-ink underline underline-offset-[5px] disabled:no-underline disabled:opacity-45"
          disabled={resendCooldown > 0 || resending}
          onClick={handleResend}
        >
          {resending
            ? "Gönderiliyor…"
            : resendCooldown > 0
              ? `Tekrar gönder (${resendCooldown} sn)`
              : "Tekrar gönder"}
        </button>
      </div>

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={isLoading || expired}>
          {isLoading ? "Doğrulanıyor…" : "Doğrula"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          E-postayı değiştir
        </button>
      </div>
    </form>
  );
}

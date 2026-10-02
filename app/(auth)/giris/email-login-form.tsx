"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendLoginOtp, resendLoginOtp } from "@/lib/actions/auth";
import { OtpVerification } from "@/components/otp-verification";
import { Room } from "@/components/plan/room";

export function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await sendLoginOtp(email);
    if (result.error) {
      setError(result.error);
    } else {
      setStep("otp");
    }
    setLoading(false);
  }

  async function handleVerifyOtp(otp: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) return error.message;

      const isAdmin = data.user?.user_metadata?.role === "admin";
      router.push(isAdmin ? "/kullanicilar" : "/");
      router.refresh();
      
      return null;
    } catch (err: any) {
      return err.message || "Doğrulama sırasında bir hata oluştu";
    }
  }

  async function handleResendOtp() {
    return resendLoginOtp(email);
  }

  if (step === "otp") {
    return (
      <Room className="p-5 md:p-7">
        <OtpVerification
          email={email}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onBack={() => {
            setStep("email");
            setError(null);
          }}
        />
      </Room>
    );
  }

  return (
    <>
      <Room className="p-5 md:p-7">
        <form onSubmit={handleSendOtp} className="space-y-5">
          <div>
            <label htmlFor="email" className="field-label">
              E-posta adresi
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ornek@eposta.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              className="field-input"
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="field-error">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Kod gönderiliyor…" : "Giriş yap"}
          </button>
        </form>
      </Room>

      <p className="mt-5 text-sm text-muted-foreground">
        Henüz kaydınız yok mu?{" "}
        <Link href="/kayit" className="text-ink underline underline-offset-[5px]">
          Görevinizi seçerek kaydolun
        </Link>
        .
      </p>
    </>
  );
}

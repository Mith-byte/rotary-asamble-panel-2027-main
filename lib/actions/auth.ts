"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { checkOtpCooldown, recordOtpSent } from "@/lib/otp-rate-limit";

export async function sendLoginOtp(email: string) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, email")
    .eq("email", email)
    .single();

  if (!profile?.first_name) {
    return { success: false, error: "Bu e-posta adresiyle kayıtlı hesap bulunamadı" };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({ email });
  recordOtpSent(email);

  return { success: true };
}

export async function resendLoginOtp(email: string) {
  const cooldown = checkOtpCooldown(email);
  if (!cooldown.allowed) {
    return { success: false, remainingSeconds: cooldown.remainingSeconds };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, email")
    .eq("email", email)
    .single();

  if (!profile?.first_name) {
    return { success: false };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({ email });
  recordOtpSent(email);

  return { success: true };
}

export async function sendSignupOtp(email: string) {
  const admin = createAdminClient();

  // Check if there's an active pricing period
  const { data: activePeriod } = await admin
    .from("pricing_periods")
    .select("id")
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString())
    .single();

  if (!activePeriod) {
    return { success: false, error: "Kayıtlar kapanmıştır" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, email")
    .eq("email", email)
    .single();

  if (profile?.first_name) {
    return { success: false, error: "Bu e-posta adresiyle zaten bir hesap mevcut" };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({ email });
  recordOtpSent(email);

  return { success: true };
}

export async function resendSignupOtp(email: string) {
  const cooldown = checkOtpCooldown(email);
  if (!cooldown.allowed) {
    return { success: false, remainingSeconds: cooldown.remainingSeconds };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({ email });
  recordOtpSent(email);

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/giris");
}

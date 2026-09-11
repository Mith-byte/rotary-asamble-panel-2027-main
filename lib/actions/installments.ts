"use server";

import { createClient } from "@/lib/supabase/server";
import { getInstallmentCount } from "@/lib/utils";

export async function uploadInstallmentDekont(
  installmentNumber: number,
  formData: FormData
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı" };
  }

  const dekont = formData.get("dekont") as File;
  if (!dekont) {
    return { error: "Dekont dosyası gerekli" };
  }

  // Upload file to storage
  const fileExt = dekont.name.split(".").pop();
  const filePath = `${user.id}/taksit-${installmentNumber}.${fileExt}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("dekontlar")
    .upload(filePath, dekont, { upsert: true });

  if (uploadError) {
    console.error("[uploadInstallmentDekont] Storage upload failed:", {
      userId: user.id,
      filePath,
      error: uploadError,
      fileSize: dekont.size,
      fileType: dekont.type,
    });
    return {
      error: `Dekont yüklenemedi (${uploadError.message}). Dosya boyutu: ${(dekont.size / 1024 / 1024).toFixed(2)}MB. Tip: ${dekont.type}`
    };
  }

  console.log("[uploadInstallmentDekont] Storage upload success:", { userId: user.id, filePath, uploadData });

  // Get installment amount from user's package
  const { data: profile } = await supabase
    .from("profiles")
    .select("package_id, pricing_type, packages!package_id(early_bird_installment_price, round_1_installment_price, round_2_installment_price)")
    .eq("id", user.id)
    .single();

  if (!profile?.package_id) {
    return { error: "Paket bilgisi bulunamadı" };
  }

  const pricingType = profile.pricing_type || "early_bird";
  const maxInstallments = getInstallmentCount(pricingType);
  if (installmentNumber > maxInstallments) {
    return { error: "Bu kayıt dönemi için taksit sayısı aşıldı" };
  }

  const pkg = profile.packages as unknown as {
    early_bird_installment_price: number;
    round_1_installment_price: number;
    round_2_installment_price: number;
  };

  const amount = pkg[`${pricingType}_installment_price` as keyof typeof pkg];

  // Upsert installment row
  const { error: upsertError } = await supabase
    .from("installments")
    .upsert(
      {
        user_id: user.id,
        installment_number: installmentNumber,
        amount,
        dekont_url: filePath,
        status: "pending" as const,
      },
      { onConflict: "user_id,installment_number" }
    );

  if (upsertError) {
    console.error("[uploadInstallmentDekont] DB upsert failed:", {
      userId: user.id,
      installmentNumber,
      error: upsertError,
    });
    return { error: `Taksit kaydedilemedi: ${upsertError.message} (Kod: ${upsertError.code})` };
  }

  console.log("[uploadInstallmentDekont] Success:", { userId: user.id, installmentNumber });
  return { success: true };
}

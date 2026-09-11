"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Creates the room a multi-occupancy package entitles the registrant to, if it
 * does not already exist.
 *
 * Idempotent: if a room is already assigned it does nothing, so a double click
 * or a stale page cannot produce two rooms.
 */
export async function ensureRoom(): Promise<{ error?: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Oturumunuz sona erdi. Baştan giriş yapın." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("room_id, packages!package_id(capacity)")
    .eq("id", user.id)
    .single();

  if (profile?.room_id) return;

  const capacity = (profile?.packages as unknown as { capacity: number | null } | null)
    ?.capacity;

  if (!capacity || capacity <= 1) {
    return { error: "Paketiniz çok kişilik bir oda içermiyor." };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ capacity, created_by: user.id })
    .select("id")
    .single();

  if (roomError || !room) {
    console.error("[ensureRoom] Room creation failed:", roomError);
    return { error: "Oda oluşturulamadı. Tekrar deneyin." };
  }

  const { error: assignError } = await supabase
    .from("profiles")
    .update({ room_id: room.id })
    .eq("id", user.id);

  if (assignError) {
    console.error("[ensureRoom] Room assignment failed:", assignError);
    return { error: "Oda oluşturuldu ancak kaydınıza bağlanamadı. Tekrar deneyin." };
  }

  revalidatePath("/oda-planlama");
}

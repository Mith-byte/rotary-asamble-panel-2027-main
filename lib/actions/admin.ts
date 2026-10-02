"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return { user, admin };
}

export async function approveUser(userId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  const { error } = await ctx.admin
    .from("profiles")
    .update({ status: "accepted" })
    .eq("id", userId);

  if (error) return { error: "Kullanıcı onaylanamadı" };
  return { success: true };
}

async function cleanupUserData(admin: ReturnType<typeof createAdminClient>, userId: string, roomId: string | null) {
  // Handle room departure
  if (roomId) {
    await admin
      .from("room_invitations")
      .update({ status: "cancelled" })
      .eq("invited_by", userId)
      .eq("status", "pending");

    await admin
      .from("room_invitations")
      .update({ status: "cancelled" })
      .eq("invited_user_id", userId)
      .eq("status", "pending");

    await admin.from("profiles").update({ room_id: null }).eq("id", userId);

    const { data: room } = await admin
      .from("rooms")
      .select("id, created_by")
      .eq("id", roomId)
      .single();

    if (room) {
      const { data: remainingMembers } = await admin
        .from("profiles")
        .select("id")
        .eq("room_id", room.id);

      if (!remainingMembers || remainingMembers.length === 0) {
        await admin.from("rooms").delete().eq("id", room.id);
      } else if (room.created_by === userId) {
        await admin
          .from("rooms")
          .update({ created_by: remainingMembers[0].id })
          .eq("id", room.id);
      }
    }
  }
}

/**
 * Ödeme iptali: Kullanıcının ödeme onayını geri alır.
 * Kullanıcıyı silmez, sadece 'waiting' (Ödeme Bekliyor) statüsüne çeker.
 */
export async function rejectUser(userId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  const { error } = await ctx.admin
    .from("profiles")
    .update({ status: "waiting" })
    .eq("id", userId);

  if (error) return { error: "Ödeme onayı geri alınamadı" };
  return { success: true };
}

export async function deleteUser(userId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  const { data: profile } = await ctx.admin
    .from("profiles")
    .select("room_id")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "Kullanıcı bulunamadı" };

  await cleanupUserData(ctx.admin, userId, profile.room_id);

  const { error } = await ctx.admin.auth.admin.deleteUser(userId);

  if (error) return { error: "Kullanıcı silinemedi" };
  return { success: true };
}

export async function changeUserPackage(userId: string, newPackageId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  const { data: profile } = await ctx.admin
    .from("profiles")
    .select("package_id, room_id")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "Kullanıcı bulunamadı" };
  if (profile.package_id === newPackageId)
    return { error: "Aynı paket seçilemez" };

  await cleanupUserData(ctx.admin, userId, profile.room_id);

  // Fetch new package
  const { data: newPkg } = await ctx.admin
    .from("packages")
    .select("capacity")
    .eq("id", newPackageId)
    .single();

  // Update profile with new package
  await ctx.admin
    .from("profiles")
    .update({ package_id: newPackageId, dekont_url: null })
    .eq("id", userId);

  // Create room if new package has capacity > 1
  if (newPkg?.capacity && newPkg.capacity > 1) {
    const { data: newRoom } = await ctx.admin
      .from("rooms")
      .insert({ capacity: newPkg.capacity, created_by: userId })
      .select("id")
      .single();

    if (newRoom) {
      await ctx.admin
        .from("profiles")
        .update({ room_id: newRoom.id })
        .eq("id", userId);
    }
  }

  return { success: true };
}

export async function adminRemoveMemberFromRoom(userId: string, roomId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  // Cancel user's pending invitations related to this room
  await ctx.admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("invited_by", userId)
    .eq("status", "pending");

  await ctx.admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("invited_user_id", userId)
    .eq("status", "pending");

  // Remove user from room
  await ctx.admin.from("profiles").update({ room_id: null }).eq("id", userId);

  // Handle room creator transfer
  const { data: room } = await ctx.admin
    .from("rooms")
    .select("id, created_by")
    .eq("id", roomId)
    .single();

  if (room) {
    const { data: remaining } = await ctx.admin
      .from("profiles")
      .select("id")
      .eq("room_id", room.id);

    if (!remaining || remaining.length === 0) {
      await ctx.admin.from("rooms").delete().eq("id", room.id);
    } else if (room.created_by === userId) {
      await ctx.admin
        .from("rooms")
        .update({ created_by: remaining[0].id })
        .eq("id", room.id);
    }
  }

  // Create a new solo room for the removed user
  const { data: profile } = await ctx.admin
    .from("profiles")
    .select("packages!package_id(capacity)")
    .eq("id", userId)
    .single();

  const capacity = (profile?.packages as unknown as { capacity: number } | null)?.capacity;
  if (capacity && capacity > 1) {
    const { data: newRoom } = await ctx.admin
      .from("rooms")
      .insert({ capacity, created_by: userId })
      .select("id")
      .single();

    if (newRoom) {
      await ctx.admin
        .from("profiles")
        .update({ room_id: newRoom.id })
        .eq("id", userId);
    }
  }

  return { success: true };
}

export async function adminDeleteRoom(roomId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  // Get all members
  const { data: members } = await ctx.admin
    .from("profiles")
    .select("id, packages!package_id(capacity)")
    .eq("room_id", roomId);

  // Cancel all pending invitations for this room
  await ctx.admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("room_id", roomId)
    .eq("status", "pending");

  // Remove all members from the room
  await ctx.admin
    .from("profiles")
    .update({ room_id: null })
    .eq("room_id", roomId);

  // Delete the room
  await ctx.admin.from("rooms").delete().eq("id", roomId);

  // Create new solo rooms for each member
  for (const member of members ?? []) {
    const capacity = (member.packages as unknown as { capacity: number } | null)?.capacity;
    if (capacity && capacity > 1) {
      const { data: newRoom } = await ctx.admin
        .from("rooms")
        .insert({ capacity, created_by: member.id })
        .select("id")
        .single();

      if (newRoom) {
        await ctx.admin
          .from("profiles")
          .update({ room_id: newRoom.id })
          .eq("id", member.id);
      }
    }
  }

  return { success: true };
}

export async function adminAddMemberToRoom(userId: string, roomId: string) {
  const ctx = await verifyAdmin();
  if (!ctx) return { error: "Yetkisiz erişim" };

  // Check room capacity
  const { data: room } = await ctx.admin
    .from("rooms")
    .select("id, capacity")
    .eq("id", roomId)
    .single();

  if (!room) return { error: "Oda bulunamadı" };

  const { data: currentMembers } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("room_id", roomId);

  if ((currentMembers?.length ?? 0) >= room.capacity) {
    return { error: "Oda dolu" };
  }

  // Get user's current room
  const { data: profile } = await ctx.admin
    .from("profiles")
    .select("room_id")
    .eq("id", userId)
    .single();

  // Cancel user's pending invitations
  await ctx.admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("invited_by", userId)
    .eq("status", "pending");

  await ctx.admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("invited_user_id", userId)
    .eq("status", "pending");

  // Delete old solo room if exists
  if (profile?.room_id) {
    await ctx.admin.from("profiles").update({ room_id: null }).eq("id", userId);
    // Only delete if room is now empty
    const { data: remaining } = await ctx.admin
      .from("profiles")
      .select("id")
      .eq("room_id", profile.room_id);

    if (!remaining || remaining.length === 0) {
      await ctx.admin.from("rooms").delete().eq("id", profile.room_id);
    }
  }

  // Add user to target room
  const { error } = await ctx.admin
    .from("profiles")
    .update({ room_id: roomId })
    .eq("id", userId);

  if (error) return { error: "Kullanıcı odaya eklenemedi" };
  return { success: true };
}


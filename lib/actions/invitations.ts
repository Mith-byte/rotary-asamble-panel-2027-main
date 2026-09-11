"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendRoomInvitation(email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const admin = createAdminClient();

  // Get sender's profile with room info
  const { data: sender } = await supabase
    .from("profiles")
    .select("package_id, room_id, rooms!room_id(capacity, created_by)")
    .eq("id", user.id)
    .single();

  if (!sender?.room_id) return { error: "Odanız bulunmuyor" };

  const room = sender.rooms as unknown as {
    capacity: number;
    created_by: string;
  } | null;
  if (!room) return { error: "Oda bilgisi alınamadı" };
  if (room.created_by !== user.id)
    return { error: "Sadece oda sahibi davet gönderebilir" };

  // Check capacity (members + pending invitations)
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("room_id", sender.room_id);

  const { count: pendingCount } = await admin
    .from("room_invitations")
    .select("id", { count: "exact", head: true })
    .eq("room_id", sender.room_id)
    .eq("status", "pending");

  const occupied = (memberCount ?? 0) + (pendingCount ?? 0);
  if (occupied >= room.capacity) return { error: "Oda dolu" };

  // Always return success to prevent user enumeration
  const { data: target } = await admin
    .from("profiles")
    .select("id, room_id, package_id")
    .eq("email", email)
    .single();

  if (!target) {
    console.log("[sendRoomInvitation] target not found, returning success (no enumeration)");
    return { success: true };
  }
  if (target.id === user.id) {
    console.log("[sendRoomInvitation] target is self, skipping");
    return { success: true };
  }
  if (target.package_id !== sender.package_id) {
    return { error: "Sadece aynı paketteki kullanıcıları davet edebilirsiniz" };
  }
  // Check for existing pending invitation
  const { data: existing } = await admin
    .from("room_invitations")
    .select("id")
    .eq("room_id", sender.room_id)
    .eq("invited_user_id", target.id)
    .eq("status", "pending")
    .single();

  if (existing) {
    console.log("[sendRoomInvitation] pending invitation already exists:", existing.id);
    return { success: true };
  }

  // Create invitation
  const { error: insertError } = await admin.from("room_invitations").insert({
    room_id: sender.room_id,
    invited_by: user.id,
    invited_user_id: target.id,
  });

  console.log("[sendRoomInvitation] invitation created, insert error:", insertError?.message ?? "none");

  return { success: true };
}

export async function respondToInvitation(
  invitationId: string,
  accept: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  // Fetch invitation
  const { data: invitation } = await supabase
    .from("room_invitations")
    .select("id, room_id, invited_user_id, status")
    .eq("id", invitationId)
    .single();

  if (!invitation) return { error: "Davet bulunamadı" };
  if (invitation.invited_user_id !== user.id)
    return { error: "Bu davet size ait değil" };
  if (invitation.status !== "pending")
    return { error: "Bu davet artık geçerli değil" };

  if (!accept) {
    await supabase
      .from("room_invitations")
      .update({ status: "rejected" })
      .eq("id", invitationId);
    return { success: true };
  }

  // Accept: check room capacity and package match
  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("capacity, created_by")
    .eq("id", invitation.room_id)
    .single();

  if (!room) return { error: "Oda bulunamadı" };

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("room_id", invitation.room_id);

  if ((count ?? 0) >= room.capacity) return { error: "Oda dolu" };

  // Check package match with room creator
  const [{ data: myProfile }, { data: ownerProfile }] = await Promise.all([
    admin.from("profiles").select("package_id").eq("id", user.id).single(),
    admin.from("profiles").select("package_id").eq("id", room.created_by).single(),
  ]);

  if (myProfile?.package_id !== ownerProfile?.package_id) {
    return { error: "Paketiniz oda sahibinin paketiyle eşleşmiyor" };
  }

  // Leave current room if in one
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("room_id")
    .eq("id", user.id)
    .single();

  if (currentProfile?.room_id) {
    const oldRoomId = currentProfile.room_id;

    // Remove from old room first
    await admin
      .from("profiles")
      .update({ room_id: null })
      .eq("id", user.id);

    // Check if anyone else is still in the old room
    const { data: remainingInOld } = await admin
      .from("profiles")
      .select("id")
      .eq("room_id", oldRoomId);

    const remainingOldMembers = remainingInOld ?? [];

    if (remainingOldMembers.length === 0) {
      // Room is empty, delete it
      await admin.from("rooms").delete().eq("id", oldRoomId);
    } else {
      // Transfer creator if the leaving user was the creator
      const { data: oldRoom } = await admin
        .from("rooms")
        .select("created_by")
        .eq("id", oldRoomId)
        .single();

      if (oldRoom?.created_by === user.id) {
        await admin
          .from("rooms")
          .update({ created_by: remainingOldMembers[0].id })
          .eq("id", oldRoomId);
      }
    }
  }

  // Join new room
  const { error: joinError } = await admin
    .from("profiles")
    .update({ room_id: invitation.room_id })
    .eq("id", user.id);

  if (joinError) return { error: "Odaya katılınamadı" };

  // Mark accepted
  await admin
    .from("room_invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId);

  // Cancel all other pending invitations for this user
  await admin
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("invited_user_id", user.id)
    .eq("status", "pending")
    .neq("id", invitationId);

  return { success: true };
}

export async function leaveRoom() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("room_id, packages!package_id(capacity)")
    .eq("id", user.id)
    .single();

  if (!profile?.room_id) return { error: "Zaten bir odada değilsiniz" };

  const roomId = profile.room_id;
  const capacity = (profile.packages as unknown as { capacity: number | null } | null)?.capacity;

  // Check if user is alone in the room
  const { count: memberCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);

  if ((memberCount ?? 0) <= 1) return { error: "Odada tek kişi olduğunuzda ayrılamazsınız" };

  // Remove user from room
  await admin
    .from("profiles")
    .update({ room_id: null })
    .eq("id", user.id);

  // Check if user was the room creator
  const { data: roomData } = await admin
    .from("rooms")
    .select("created_by")
    .eq("id", roomId)
    .single();

  const wasCreator = roomData?.created_by === user.id;

  // If creator leaves, cancel ALL pending invitations for the room
  // Otherwise, only cancel invitations sent by this user
  if (wasCreator) {
    await admin
      .from("room_invitations")
      .update({ status: "cancelled" })
      .eq("room_id", roomId)
      .eq("status", "pending");
  } else {
    await admin
      .from("room_invitations")
      .update({ status: "cancelled" })
      .eq("room_id", roomId)
      .eq("invited_by", user.id)
      .eq("status", "pending");
  }

  // Check remaining members in old room
  const { data: remaining } = await admin
    .from("profiles")
    .select("id")
    .eq("room_id", roomId);

  const remainingMembers = remaining ?? [];

  if (remainingMembers.length === 0) {
    // Old room is empty, delete it
    await admin.from("rooms").delete().eq("id", roomId);
  } else if (wasCreator) {
    // Transfer creator to first remaining member
    await admin
      .from("rooms")
      .update({ created_by: remainingMembers[0].id })
      .eq("id", roomId);
  }

  // Create a new room for the user if their package has capacity
  if (capacity && capacity > 1) {
    const { data: newRoom } = await admin
      .from("rooms")
      .insert({ capacity, created_by: user.id })
      .select("id")
      .single();

    if (newRoom) {
      await admin
        .from("profiles")
        .update({ room_id: newRoom.id })
        .eq("id", user.id);
    }
  }

  return { success: true };
}

export async function cancelInvitation(invitationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: invitation } = await supabase
    .from("room_invitations")
    .select("id, invited_by, status")
    .eq("id", invitationId)
    .single();

  if (!invitation) return { error: "Davet bulunamadı" };
  if (invitation.invited_by !== user.id)
    return { error: "Bu daveti sadece gönderen iptal edebilir" };
  if (invitation.status !== "pending")
    return { error: "Bu davet artık geçerli değil" };

  await supabase
    .from("room_invitations")
    .update({ status: "cancelled" })
    .eq("id", invitationId);

  return { success: true };
}

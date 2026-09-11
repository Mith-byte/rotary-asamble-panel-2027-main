import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { InviteDialog } from "./invite-dialog";
import { CreateRoomButton } from "./create-room";
import { InvitationsIsland, SentInvitations, LeaveRoomButton } from "./pending-invitations";
import { PageHead, Room } from "@/components/plan/room";
import { Dimension } from "@/components/plan/dimension";
import { Empty } from "@/components/plan/empty";

interface RoomMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
}

export default async function OdaPlanlamaPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("room_id, packages!package_id(capacity, nights)")
    .eq("id", user!.id)
    .single();

  const pkg = profile?.packages as unknown as {
    capacity: number | null;
    nights: number | null;
  } | null;
  const capacity = pkg?.capacity;
  const nights = pkg?.nights;
  const roomId = profile?.room_id;

  // Fetch received invitations (before early return so users without a room see them too)
  const { data: receivedRaw } = await supabase
    .from("room_invitations")
    .select("id, room_id, invited_by")
    .eq("invited_user_id", user!.id)
    .eq("status", "pending");

  const receivedInvitations = await Promise.all(
    (receivedRaw ?? []).map(async (inv) => {
      const { data: inviter } = await admin
        .from("profiles")
        .select("first_name, last_name, club")
        .eq("id", inv.invited_by)
        .single();

      const { data: room } = await admin
        .from("rooms")
        .select("capacity")
        .eq("id", inv.room_id)
        .single();

      return {
        id: inv.id,
        inviterName: `${inviter?.first_name ?? ""} ${inviter?.last_name ?? ""}`.trim(),
        inviterClub: inviter?.club ?? null,
        roomCapacity: room?.capacity ?? 0,
      };
    })
  );

  /*
    There are three different reasons someone has no room to plan, and they are
    not interchangeable. Telling a registrant with a 3-person package that
    "paketiniz oda içermiyor" is simply false, and it sends them to the district
    to fix a problem they do not have.
  */
  const noRoom = !capacity
    ? {
        title: "Kaydınız henüz tamamlanmadı",
        body: "Paketiniz seçildikten sonra odanız burada görünecek.",
      }
    : nights === 0
      ? {
          title: "Paketiniz konaklama içermiyor",
          body: "Konaklamasız paketler oda taşımaz. Konaklamalı bir pakete geçmek isterseniz bölge ile iletişime geçin.",
        }
      : capacity <= 1
        ? {
            title: "Odanız tek kişilik",
            body: "Tek kişilik odalarda planlanacak bir şey yok — odanız size ayrıldı. Oda arkadaşı davet etmek isterseniz çok kişilik bir paket gerekir.",
          }
        : null;

  if (noRoom || !roomId) {
    return (
      <div className="space-y-7">
        <PageHead
          tag="Oda"
          title="Oda planlama"
          lead="Çok kişilik bir paket aldıysanız odanızı burada kurar ve oda arkadaşlarınızı davet edersiniz."
        />

        <InvitationsIsland received={receivedInvitations} />

        {receivedInvitations.length === 0 &&
          (noRoom ? (
            <Empty title={noRoom.title}>{noRoom.body}</Empty>
          ) : (
            /* A multi-occupancy package with no room row. The room is created
               with the registration, so this only happens if that write did
               not land — recoverable, and the registrant can do it here rather
               than being told to contact the district. */
            <Empty
              title="Odanız henüz kurulmadı"
              action={<CreateRoomButton />}
            >
              {capacity} kişilik paketiniz oda taşıyor, ancak odanız oluşturulmamış.
              Odanızı şimdi kurabilir, sonra oda arkadaşlarınızı davet edebilirsiniz.
            </Empty>
          ))}
      </div>
    );
  }

  // Fetch room members (admin bypasses RLS so we can see all roommates)
  const { data: members } = await admin
    .from("profiles")
    .select("id, first_name, last_name, club")
    .eq("room_id", roomId);

  const roomMembers = (members ?? []) as RoomMember[];

  // Check if current user is room creator
  const { data: room } = await supabase
    .from("rooms")
    .select("created_by")
    .eq("id", roomId)
    .single();

  const isCreator = room?.created_by === user!.id;

  // Fetch sent invitations for room creator
  let sentInvitations: { id: string; invitedName: string }[] = [];
  if (isCreator) {
    const { data: sentRaw } = await supabase
      .from("room_invitations")
      .select("id, invited_user_id")
      .eq("invited_by", user!.id)
      .eq("status", "pending");

    sentInvitations = await Promise.all(
      (sentRaw ?? []).map(async (inv) => {
        const { data: invited } = await admin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", inv.invited_user_id)
          .single();

        return {
          id: inv.id,
          invitedName: `${invited?.first_name ?? ""} ${invited?.last_name ?? ""}`.trim(),
        };
      })
    );
  }

  const emptySlots = capacity! - roomMembers.length - sentInvitations.length;
  const canInvite = isCreator && emptySlots > 0;

  return (
    <div className="space-y-7">
      <PageHead
        tag="Oda"
        figure={`${roomMembers.length}/${capacity} KİŞİ`}
        title="Oda planlama"
        lead="Odanızdaki yerler aşağıda. Boş yer kaldıysa oda arkadaşınızı davet edebilirsiniz."
      >
        <div className="flex flex-wrap items-center gap-3">
          {canInvite && <InviteDialog />}
          {roomMembers.length > 1 && <LeaveRoomButton />}
        </div>
      </PageHead>

      <Room className="p-4 md:p-6">
        <Dimension
          label="Dolu yer"
          value={roomMembers.length}
          total={capacity!}
          figure={emptySlots > 0 ? `${emptySlots} boş yer` : "Oda dolu"}
        />
      </Room>

      <InvitationsIsland received={receivedInvitations} />

      <Room className="p-4 md:p-6">
        <h2 className="t-sheet mb-3 text-[0.8125rem]">Odadakiler</h2>
        <ul>
          {roomMembers.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 border-b border-rule py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="t-label truncate text-[0.9375rem]">
                  {member.first_name} {member.last_name}
                </p>
                {member.club && (
                  <p className="truncate text-[0.8125rem] text-muted-foreground">
                    {member.club}
                  </p>
                )}
              </div>
              {member.id === room?.created_by && (
                <span className="state t-note" data-state="accepted">
                  Odayı kuran
                </span>
              )}
              {member.id === user!.id && (
                <span className="state t-note" data-state="waiting">
                  Siz
                </span>
              )}
            </li>
          ))}

          <SentInvitations invitations={sentInvitations} />

          {/* An empty bed is a void: the slot the room carries but nobody
              holds. Drawn dashed and hatched, the same way a package draws an
              axis it does not include. */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="draft-ground flex items-center gap-3 border-b border-dashed border-ink/35 py-3"
            >
              <p className="t-note text-muted-foreground">Boş yer</p>
            </li>
          ))}
        </ul>
      </Room>
    </div>
  );
}

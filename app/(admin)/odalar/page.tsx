import { createAdminClient } from "@/lib/supabase/admin";
import { BedDouble, Users, CheckCircle, Clock } from "lucide-react";
import { AdminListControls } from "@/components/admin-list-controls";
import { RemoveMember, DeleteRoom, AddMember } from "./room-actions";
import { RoomSearch } from "./room-search";
import { dutyLabel } from "@/lib/duties";

interface RoomMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
  gorev: string | null;
  gender: string | null;
  package_id: string | null;
  packages: { name: string } | null;
}

interface Room {
  id: string;
  capacity: number;
  created_by: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

const PAGE_SIZE = 10;
const VALID_STATUSES = ["all", "full", "available"];
const FILTER_OPTIONS = [
  { label: "Tümü", value: "all" },
  { label: "Dolu", value: "full" },
  { label: "Boş Yer Var", value: "available" },
];

export default async function OdalarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = VALID_STATUSES.includes(params.status ?? "all")
    ? (params.status ?? "all")
    : "all";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const searchQuery = (params.q ?? "").trim().toLowerCase();

  const admin = createAdminClient();

  // Fetch all rooms with creator info
  const { data: allRooms } = await admin
    .from("rooms")
    .select("id, capacity, created_by, profiles!created_by(first_name, last_name)")
    .order("created_at", { ascending: true });

  const rooms = (allRooms ?? []) as unknown as Room[];

  // Fetch all profiles that have a room_id (batch query instead of N+1)
  const roomIds = rooms.map((r) => r.id);
  const { data: allMembers } = await admin
    .from("profiles")
    .select("id, first_name, last_name, club, gorev, gender, room_id, package_id, packages!package_id(name)")
    .in("room_id", roomIds);

  const members = (allMembers ?? []) as unknown as (RoomMember & { room_id: string })[];

  // Group members by room_id
  const membersByRoom = new Map<string, (RoomMember & { room_id: string })[]>();
  for (const m of members) {
    const list = membersByRoom.get(m.room_id) ?? [];
    list.push(m);
    membersByRoom.set(m.room_id, list);
  }

  // Fetch users with 1-person packages (they don't have rooms)
  const { data: soloPackageUsers } = await admin
    .from("profiles")
    .select("id, first_name, last_name, club, gorev, gender, package_id, packages!package_id(name, capacity)")
    .is("room_id", null)
    .not("first_name", "is", null);

  const soloUsers = (soloPackageUsers ?? []).filter(
    (u) => (u.packages as unknown as { capacity: number } | null)?.capacity === 1
  ) as unknown as (RoomMember & { packages: { name: string; capacity: number } })[];

  // Build enriched room data
  const enrichedRooms = rooms.map((room) => {
    const roomMembers = membersByRoom.get(room.id) ?? [];
    const isFull = roomMembers.length >= room.capacity;
    return { ...room, members: roomMembers, isFull, isSoloPackage: false };
  });

  // Add 1-person package users as virtual "rooms"
  for (const user of soloUsers) {
    enrichedRooms.push({
      id: `solo-${user.id}`,
      capacity: 1,
      created_by: user.id,
      profiles: null,
      members: [{ ...user, room_id: `solo-${user.id}` } as RoomMember & { room_id: string }],
      isFull: true,
      isSoloPackage: true,
    });
  }

  // Find solo users (alone in their room) grouped by package_id
  const soloUsersByPackage = new Map<string, { id: string; first_name: string | null; last_name: string | null; club: string | null }[]>();
  for (const room of enrichedRooms) {
    if (room.members.length === 1) {
      const member = room.members[0];
      if (member.package_id) {
        const list = soloUsersByPackage.get(member.package_id) ?? [];
        list.push({ id: member.id, first_name: member.first_name, last_name: member.last_name, club: member.club });
        soloUsersByPackage.set(member.package_id, list);
      }
    }
  }

  // Summary counts
  const totalCount = enrichedRooms.length;
  const fullCount = enrichedRooms.filter((r) => r.isFull).length;
  const availableCount = totalCount - fullCount;

  // Filter by status and search query
  const filtered = enrichedRooms.filter((r) => {
    if (statusFilter === "full" && !r.isFull) return false;
    if (statusFilter === "available" && r.isFull) return false;
    if (searchQuery) {
      return r.members.some((m) => {
        const fullName = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
        return fullName.includes(searchQuery);
      });
    }
    return true;
  });

  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const from = (currentPage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(from, from + PAGE_SIZE);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <span className="t-note text-muted-foreground">
          {"// YÖNETİM"}
        </span>
        <h1 className="t-sheet mt-2 mb-1 text-ink">
          Odalar
        </h1>
        <p className="text-muted-foreground text-sm">
          Oda atamalarını yönetin
        </p>
        <div className="border-t border-rule max-w-md mt-4" />
      </div>

      {/* Summary strip */}
      <div className="border-t border-b border-ink py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-ink" />
          <span className="t-note text-muted-foreground">
            {totalCount} Oda
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 t-note text-ink">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            {fullCount} Dolu
          </span>
          <span className="flex items-center gap-1.5 t-note text-yellow-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {availableCount} Boş Yer Var
          </span>
        </div>
      </div>

      {/* Search + Filters + pagination */}
      <RoomSearch currentQuery={params.q ?? ""} />
      <AdminListControls
        filterOptions={FILTER_OPTIONS}
        currentStatus={statusFilter}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {/* Room cards */}
      <div className="space-y-4">
        {paginated.map((room, idx) => {
          // Get the package_id of the first member to find matching solo users
          const roomPackageId = room.members[0]?.package_id;
          const availableSoloUsers = roomPackageId
            ? (soloUsersByPackage.get(roomPackageId) ?? []).filter(
                (u) => !room.members.some((m) => m.id === u.id)
              )
            : [];

          return (
            <div key={room.id} className="room-plain p-3 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 shrink-0 border border-ink flex items-center justify-center">
                    <span className="font-display text-sm font-bold text-ink">
                      {from + idx + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="t-note text-foreground">
                      Oda {from + idx + 1}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-ink">
                        {room.members.length}/{room.capacity}
                      </span>
                      <span className="t-note text-muted-foreground">
                        Kişi
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!room.isFull && !room.isSoloPackage && (
                    <AddMember roomId={room.id} soloUsers={availableSoloUsers} />
                  )}
                  {room.isSoloPackage ? (
                    <span className="flex items-center gap-1.5 t-note text-muted-foreground px-2 py-1 border border-muted-foreground/30 bg-muted-foreground/5 w-fit">
                      Tek Kişilik Paket
                    </span>
                  ) : room.isFull ? (
                    <span className="flex items-center gap-1.5 t-note text-ink px-2 py-1 border border-ink w-fit">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      Dolu
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 t-note text-yellow-400 px-2 py-1 border border-yellow-400/40 bg-yellow-400/5 w-fit">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Boş Yer Var
                    </span>
                  )}
                  {!room.isSoloPackage && <DeleteRoom roomId={room.id} />}
                </div>
              </div>

              {/* Members */}
              <div className="border-t border-ink pt-3 space-y-2">
                {room.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 border border-ink flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-xs tracking-wider text-foreground truncate">
                        {member.first_name} {member.last_name}
                        {member.id === room.created_by && (
                          <span className="ml-2 t-note text-muted-foreground px-1.5 py-0.5 border border-ink">
                            Kurucu
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {member.club && (
                          <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">
                            {member.club}
                          </span>
                        )}
                        {member.gender && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">
                              {member.gender}
                            </span>
                          </>
                        )}
                        {dutyLabel(member.gorev) && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">
                              {dutyLabel(member.gorev)}
                            </span>
                          </>
                        )}
                        {member.packages?.name && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">
                              {member.packages.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {room.members.length > 1 && !room.isSoloPackage && (
                      <RemoveMember userId={member.id} roomId={room.id} />
                    )}
                  </div>
                ))}
                {room.members.length === 0 && (
                  <p className="t-note text-muted-foreground">
                    Bu odada henüz kimse yok
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {paginated.length === 0 && (
          <div className="room-plain p-6">
            <p className="t-note text-muted-foreground">
              {statusFilter === "all" ? "Henüz oda oluşturulmamış" : "Bu filtreyle eşleşen oda bulunamadı"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom pagination */}
      <AdminListControls
        filterOptions={FILTER_OPTIONS}
        currentStatus={statusFilter}
        currentPage={currentPage}
        totalPages={totalPages}
        showFilters={false}
      />
    </div>
  );
}

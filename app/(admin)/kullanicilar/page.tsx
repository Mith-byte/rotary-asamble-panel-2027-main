import { createAdminClient } from "@/lib/supabase/admin";
import { Users, Clock, CheckCircle } from "lucide-react";
import { UserActions } from "./user-actions";
import { DeleteUser } from "./delete-user";
import { PackageChange } from "./package-change";
import { AdminListControls } from "@/components/admin-list-controls";
import { ExportCsv } from "./export-csv";
import { UserSearch } from "./user-search";
import { dutyLabel } from "@/lib/duties";
import { HOST_CLUB } from "@/lib/clubs";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
  gorev: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  package_id: string | null;
  status: "waiting" | "accepted";
  packages: { name: string } | null;
}

const PAGE_SIZE = 10;
const VALID_STATUSES = ["all", "waiting", "accepted"];
const FILTER_OPTIONS = [
  { label: "Tümü", value: "all" },
  { label: "Beklemede", value: "waiting" },
  { label: "Onaylı", value: "accepted" },
];

export default async function KullanicilarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = VALID_STATUSES.includes(params.status ?? "all")
    ? (params.status ?? "all")
    : "all";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const searchQuery = (params.q ?? "").trim();

  const admin = createAdminClient();

  // Summary counts (always unfiltered, excluding Dokuz Eylül)
  const { count: totalCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .neq("club", HOST_CLUB);

  const { count: waitingCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "waiting")
    .neq("club", HOST_CLUB);

  const acceptedCount = (totalCount ?? 0) - (waitingCount ?? 0);

  // Filtered + paginated data query
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("profiles")
    .select("id, first_name, last_name, club, gorev, gender, email, phone, package_id, status, packages!package_id(name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (searchQuery) {
    query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
  }

  const { data: profiles, count: filteredCount } = await query.range(from, to);

  const users = (profiles ?? []) as unknown as Profile[];
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));

  const { data: allPackages } = await admin
    .from("packages")
    .select("id, name")
    .order("sort_order", { ascending: true });

  const packageOptions = (allPackages ?? []) as { id: string; name: string }[];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <span className="t-note text-muted-foreground">
          {"// YÖNETİM"}
        </span>
        <h1 className="t-sheet mt-2 mb-1 text-ink">
          Kullanıcılar
        </h1>
        <p className="text-muted-foreground text-sm">
          Kullanıcı kayıtlarını yönetin
        </p>
        <div className="border-t border-rule max-w-md mt-4" />
      </div>

      {/* Summary strip */}
      <div className="border-t border-b border-ink py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ink" />
          <span className="t-note text-muted-foreground">
            {totalCount ?? 0} Kullanıcı
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 t-note text-yellow-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {waitingCount ?? 0} Beklemede
          </span>
          <span className="flex items-center gap-1.5 t-note text-ink">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            {acceptedCount} Onaylı
          </span>
          <ExportCsv />
        </div>
      </div>

      {/* Search + Filters + pagination */}
      <UserSearch currentQuery={params.q ?? ""} />
      <AdminListControls
        filterOptions={FILTER_OPTIONS}
        currentStatus={statusFilter}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {/* User list */}
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="room-plain p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 border border-ink flex items-center justify-center shrink-0">
                <span className="font-display text-sm font-bold text-ink">
                  {user.first_name?.[0] ?? "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="t-label text-foreground truncate">
                  {user.first_name} {user.last_name}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {user.club && (
                    <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                      {user.club}
                    </span>
                  )}
                  {user.gender && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                        {user.gender}
                      </span>
                    </>
                  )}
                  {dutyLabel(user.gorev) && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                        {dutyLabel(user.gorev)}
                      </span>
                    </>
                  )}
                  {user.packages?.name && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                        {user.packages.name}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {user.phone && (
                    <a href={`tel:+${user.phone}`} className="text-[10px] text-muted-foreground t-label hover:text-ink transition-colors">
                      +{user.phone}
                    </a>
                  )}
                  {user.email && (
                    <>
                      {user.phone && <span className="text-muted-foreground/40">·</span>}
                      <a href={`mailto:${user.email}`} className="text-[10px] text-muted-foreground t-label hover:text-ink transition-colors">
                        {user.email}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                <PackageChange userId={user.id} currentPackageId={user.package_id} packages={packageOptions} />
                {user.status === "accepted" ? (
                  <span className="t-note text-ink px-2 py-0.5 border border-ink">
                    Onaylı
                  </span>
                ) : (
                  <>
                    <span className="t-note text-yellow-400 px-2 py-0.5 border border-yellow-400/40 bg-yellow-400/5">
                      Beklemede
                    </span>
                    <UserActions userId={user.id} />
                  </>
                )}
                <DeleteUser userId={user.id} />
              </div>
            </div>
            <div className="flex sm:hidden items-center gap-3 mt-3 pt-3 border-t border-ink">
              <PackageChange userId={user.id} currentPackageId={user.package_id} packages={packageOptions} />
              {user.status === "accepted" ? (
                <span className="t-note text-ink px-2 py-0.5 border border-ink">
                  Onaylı
                </span>
              ) : (
                <>
                  <span className="t-note text-yellow-400 px-2 py-0.5 border border-yellow-400/40 bg-yellow-400/5">
                    Beklemede
                  </span>
                  <UserActions userId={user.id} />
                </>
              )}
              <DeleteUser userId={user.id} />
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="room-plain p-6">
            <p className="t-note text-muted-foreground">
              Bu filtreyle eşleşen kullanıcı bulunamadı
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

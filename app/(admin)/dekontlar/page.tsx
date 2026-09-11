import { createAdminClient } from "@/lib/supabase/admin";
import { FileCheck, Clock, ExternalLink } from "lucide-react";
import { ReceiptActions } from "./receipt-actions";
import { AdminListControls } from "@/components/admin-list-controls";

interface InstallmentRow {
  id: string;
  user_id: string;
  installment_number: number;
  amount: number;
  dekont_url: string;
  status: "pending" | "accepted";
  profiles: {
    first_name: string | null;
    last_name: string | null;
    club: string | null;
  };
}

const PAGE_SIZE = 10;
const VALID_STATUSES = ["all", "pending", "accepted"];
const FILTER_OPTIONS = [
  { label: "Tümü", value: "all" },
  { label: "Beklemede", value: "pending" },
  { label: "Onaylı", value: "accepted" },
];

export default async function DekontlarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = VALID_STATUSES.includes(params.status ?? "all")
    ? (params.status ?? "all")
    : "all";
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const admin = createAdminClient();

  // Summary counts (always unfiltered, but with base dekont_url filter)
  const { count: totalCount } = await admin
    .from("installments")
    .select("*", { count: "exact", head: true })
    .not("dekont_url", "is", null);

  const { count: pendingCount } = await admin
    .from("installments")
    .select("*", { count: "exact", head: true })
    .not("dekont_url", "is", null)
    .eq("status", "pending");

  const acceptedCount = (totalCount ?? 0) - (pendingCount ?? 0);

  // Filtered + paginated data query
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("installments")
    .select("id, user_id, installment_number, amount, dekont_url, status, profiles!user_id(first_name, last_name, club)", { count: "exact" })
    .not("dekont_url", "is", null)
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: installments, count: filteredCount } = await query.range(from, to);

  const rows = (installments ?? []) as unknown as InstallmentRow[];
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));

  // Generate signed URLs (only for paginated slice — max PAGE_SIZE items)
  const rowsWithUrls = await Promise.all(
    rows.map(async (row) => {
      const { data } = await admin.storage
        .from("dekontlar")
        .createSignedUrl(row.dekont_url, 60 * 60);
      return { ...row, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <span className="t-note text-muted-foreground">
          {"// YÖNETİM"}
        </span>
        <h1 className="t-sheet mt-2 mb-1 text-ink">
          Dekontlar
        </h1>
        <p className="text-muted-foreground text-sm">
          Yüklenen dekontları inceleyin ve onaylayın
        </p>
        <div className="border-t border-rule max-w-md mt-4" />
      </div>

      {/* Summary strip */}
      <div className="border-t border-b border-ink py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-ink" />
          <span className="t-note text-muted-foreground">
            {totalCount ?? 0} Dekont
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 t-note text-yellow-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {pendingCount ?? 0} Beklemede
          </span>
          <span className="flex items-center gap-1.5 t-note text-ink">
            <FileCheck className="w-3.5 h-3.5 shrink-0" />
            {acceptedCount} Onaylı
          </span>
        </div>
      </div>

      {/* Filters + pagination */}
      <AdminListControls
        filterOptions={FILTER_OPTIONS}
        currentStatus={statusFilter}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {/* Receipt list */}
      <div className="space-y-3">
        {rowsWithUrls.map((row) => (
          <div key={row.id} className="room-plain p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 border border-ink flex items-center justify-center shrink-0">
                <span className="font-display text-sm font-bold text-ink">
                  {row.installment_number}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="t-label text-foreground truncate">
                  {row.profiles.first_name} {row.profiles.last_name}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {row.profiles.club && (
                    <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                      {row.profiles.club}
                    </span>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                    Taksit {row.installment_number}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground t-label">
                    {row.amount.toLocaleString("tr-TR")} ₺
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 shrink-0">
                {row.signedUrl && (
                  <a
                    href={row.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 t-note text-ink hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Görüntüle
                  </a>
                )}
                {row.status === "accepted" ? (
                  <span className="t-note text-ink px-2 py-0.5 border border-ink">
                    Onaylı
                  </span>
                ) : (
                  <ReceiptActions installmentId={row.id} />
                )}
              </div>
            </div>
            <div className="flex sm:hidden items-center gap-3 mt-3 pt-3 border-t border-ink">
              {row.signedUrl && (
                <a
                  href={row.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 t-note text-ink hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Görüntüle
                </a>
              )}
              {row.status === "accepted" ? (
                <span className="t-note text-ink px-2 py-0.5 border border-ink">
                  Onaylı
                </span>
              ) : (
                <ReceiptActions installmentId={row.id} />
              )}
            </div>
          </div>
        ))}

        {rowsWithUrls.length === 0 && (
          <div className="room-plain p-6">
            <p className="t-note text-muted-foreground">
              {statusFilter === "all" ? "Henüz dekont yüklenmemiş" : "Bu filtreyle eşleşen dekont bulunamadı"}
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

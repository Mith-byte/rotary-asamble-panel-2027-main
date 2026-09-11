import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { dutyLabelWithTerm } from "@/lib/duties";
import { InvitationsIsland } from "./oda-planlama/pending-invitations";
import { HOST_CLUB, getClub } from "@/lib/clubs";
import { Room, PageHead } from "@/components/plan/room";
import { Register, Row } from "@/components/plan/register";
import { StateBadge } from "@/components/plan/state";
import { Dimension } from "@/components/plan/dimension";
import { Empty } from "@/components/plan/empty";
import { PackageChips, PriceNotIssued } from "@/components/plan/package-chips";
import { event, daysUntilAssembly } from "@/lib/event";

interface Package {
  name: string;
  /* Every price is nullable: no figure has been issued for any package. */
  early_bird_price: number | null;
  early_bird_installment_price: number | null;
  round_1_price: number | null;
  round_1_installment_price: number | null;
  round_2_price: number | null;
  round_2_installment_price: number | null;
  nights: number;
  capacity: number | null;
  ceremony: boolean;
  gala: boolean;
}

/* The public site's own words for the three windows — the registrant has
   already seen these, so they must not be renamed mid-funnel. */
const PRICING_LABELS: Record<string, string> = {
  early_bird: "Erken kayıt",
  round_1: "1. dönem",
  round_2: "2. dönem",
};

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, club, gorev, phone, email, pricing_type, status, dekont_url, packages!package_id(*)")
    .eq("id", user!.id)
    .single();

  const { data: installments } = await supabase
    .from("installments")
    .select("installment_number, status, dekont_url")
    .eq("user_id", user!.id)
    .order("installment_number", { ascending: true });

  // Fetch received invitations
  const admin = createAdminClient();
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

  // Fetch global stats
  const { count: participantCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("package_id", "is", null)
    .neq("club", HOST_CLUB);

  const { data: clubs } = await admin
    .from("profiles")
    .select("club")
    .not("club", "is", null)
    .not("package_id", "is", null)
    .neq("club", HOST_CLUB);

  const uniqueClubs = new Set((clubs ?? []).map((c) => c.club)).size;


  const pkg = (profile?.packages ?? null) as unknown as Package | null;
  const pricingType = profile?.pricing_type as keyof typeof PRICING_LABELS | null;
  const price =
    pkg && pricingType
      ? pkg[`${pricingType}_price` as "early_bird_price" | "round_1_price" | "round_2_price"]
      : null;
  const registered = !!profile?.first_name && !!pkg;
  const days = daysUntilAssembly();
  const paidCount = (installments ?? []).filter((i) => i.status === "accepted").length;
  const club = getClub(profile?.club);

  return (
    <div className="space-y-8">
      <PageHead
        tag="Kaydınız"
        figure={days > 0 ? `${days} GÜN KALDI` : undefined}
        title={
          profile?.first_name
            ? `Merhaba, ${profile.first_name}`
            : "Kaydınızı tamamlayın"
        }
        lead={
          registered
            ? `${event.name}, ${event.dateLabel} tarihlerinde ${event.venue}'da toplanıyor. Oturumlar ${event.hall} salonunda.`
            : undefined
        }
      >
        <StateBadge status={profile?.status ?? null} />
      </PageHead>

      {receivedInvitations.length > 0 && (
        <InvitationsIsland received={receivedInvitations} />
      )}

      {!registered ? (
        <Empty
          title="Henüz kaydınız tamamlanmadı"
          action={
            <Link href="/profil-tamamla" className="btn btn-primary">
              Kaydınızı tamamlayın
            </Link>
          }
        >
          Görevinizi ve paketinizi seçtiğinizde kaydınız burada görünecek.
        </Empty>
      ) : (
        <>
          <Room className="p-4 md:p-6">
            <h2 className="t-sheet mb-3 text-[0.8125rem]">Kayıt kaydı</h2>
            <Register>
              <Row label="Ad soyad">
                {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "—"}
              </Row>
              <Row label="Kulüp">
                {profile?.club ?? "—"}
                {/* Only Rotary clubs carry a group number — the district
                    publishes its 15 groups for them alone. */}
                {club?.group !== undefined && (
                  <span className="ml-2 text-[0.6875rem] text-muted-foreground">
                    {club.group}. grup
                  </span>
                )}
              </Row>
              <Row label="Görev">{dutyLabelWithTerm(profile?.gorev) ?? "Seçilmedi"}</Row>
              <Row label="E-posta">{profile?.email ?? "—"}</Row>
              <Row label="Telefon">{profile?.phone ? `+${profile.phone}` : "—"}</Row>
            </Register>
          </Room>

          <Room className="p-4 md:p-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="t-sheet text-[0.8125rem]">Paketiniz</h2>
              {pricingType && (
                <p className="t-data text-[0.6875rem] text-muted-foreground">
                  {PRICING_LABELS[pricingType] ?? pricingType}
                </p>
              )}
            </div>
            <Register>
              <Row label="Paket">{pkg?.name ?? "—"}</Row>
              <Row label="Ücret">{price != null ? tl.format(price) : <PriceNotIssued />}</Row>
            </Register>
            {pkg && (
              <div className="mt-3">
                <PackageChips pkg={pkg} />
              </div>
            )}
          </Room>

          <Room className="space-y-5 p-4 md:p-6">
            <h2 className="t-sheet text-[0.8125rem]">Ölçüler</h2>
            {days > 0 && (
              <Dimension
                label="Asambleye kalan"
                value={Math.max(0, 365 - days)}
                total={365}
                figure={`${days} gün`}
              />
            )}
            {(installments ?? []).length > 0 && (
              <Dimension
                label="Onaylanan taksit"
                value={paidCount}
                total={installments!.length}
                figure={`${paidCount} / ${installments!.length}`}
              />
            )}
            <Dimension
              label="Kayıtlı katılımcı"
              value={participantCount ?? 0}
              total={Math.max(participantCount ?? 0, 1)}
              figure={`${participantCount ?? 0} kişi · ${uniqueClubs} kulüp`}
            />
          </Room>
        </>
      )}
    </div>
  );
}

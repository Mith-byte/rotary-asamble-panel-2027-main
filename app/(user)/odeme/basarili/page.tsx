import Link from "next/link";
import { CheckCircle2, ArrowRight, Home, Receipt } from "lucide-react";
import { PageHead, Room } from "@/components/plan/room";
import { Register, Row } from "@/components/plan/register";

export default async function OdemeBasariliPage({
  searchParams,
}: {
  searchParams: Promise<{ oid?: string; transId?: string }>;
}) {
  const params = await searchParams;
  const oid = params.oid || "—";
  const transId = params.transId || "—";
  const now = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödeme Onayı"
        title="Ödemeniz Başarıyla Alındı"
        lead="2440. Bölge Asamble 2027 rezervasyon ödemeniz İş Bankası 3D Secure güvencesiyle tamamlandı."
      />

      <Room className="p-6 md:p-8 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">Kayıt & Ödemeniz Onaylandı</h2>
            <p className="text-sm text-muted-foreground mt-1">
              İşleminiz başarıyla sonuçlanmış olup kaydınız kesinleşmiştir. Rezervasyon dökümünüzü aşağıdaki bilgilerle takip edebilirsiniz.
            </p>
          </div>
        </div>
      </Room>

      <Room className="p-4 md:p-6">
        <h2 className="t-sheet mb-3 text-[0.8125rem]">İşlem Detayları</h2>
        <Register>
          <Row label="Durum">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ödeme Başarılı (PAID)
            </span>
          </Row>
          <Row label="Sipariş No (OID)">
            <span className="font-mono text-xs text-ink">{oid}</span>
          </Row>
          {transId !== "—" && (
            <Row label="Banka Referans No">
              <span className="font-mono text-xs text-ink">{transId}</span>
            </Row>
          )}
          <Row label="Ödeme Yöntemi">İş Bankası Sanal POS (3D Secure)</Row>
          <Row label="İşlem Tarihi">{now}</Row>
        </Register>
      </Room>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/odemeler"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Receipt className="w-4 h-4" />
          Ödeme Dökümünü İncele
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
        <Link
          href="/"
          className="btn inline-flex items-center gap-2 border border-rule hover:bg-ink/5"
        >
          <Home className="w-4 h-4" />
          Rezervasyon Özetine Dön
        </Link>
      </div>
    </div>
  );
}

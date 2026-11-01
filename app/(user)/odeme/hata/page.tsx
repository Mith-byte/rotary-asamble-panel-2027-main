import Link from "next/link";
import { AlertCircle, RotateCcw, Home, HelpCircle } from "lucide-react";
import { PageHead, Room } from "@/components/plan/room";
import { Register, Row } from "@/components/plan/register";

export default async function OdemeHataPage({
  searchParams,
}: {
  searchParams: Promise<{ oid?: string; error?: string }>;
}) {
  const params = await searchParams;
  const oid = params.oid || "—";
  const errorMessage =
    params.error || "İşlem banka tarafından onaylanmadı veya zaman aşımına uğradı.";

  return (
    <div className="space-y-7">
      <PageHead
        tag="Ödeme Bildirimi"
        title="Ödeme Tamamlanamadı"
        lead="İş Bankası Sanal POS üzerinden gerçekleştirilen ödeme işlemi başarısız oldu."
      />

      <Room className="p-6 md:p-8 border-destructive/40 bg-destructive/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-destructive">Ödeme Gerçekleştirilemedi</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kartınızdan herhangi bir tahsilat yapılmamıştır. Lütfen aşağıdaki hata detayını kontrol ederek tekrar deneyiniz.
            </p>
          </div>
        </div>
      </Room>

      <Room className="p-4 md:p-6">
        <h2 className="t-sheet mb-3 text-[0.8125rem]">Hata Detayları</h2>
        <Register>
          <Row label="Durum">
            <span className="font-semibold text-destructive">Başarısız (FAILED)</span>
          </Row>
          <Row label="Banka / Sistem Mesajı">
            <span className="text-sm font-medium text-destructive">{errorMessage}</span>
          </Row>
          {oid !== "—" && (
            <Row label="Sipariş No (OID)">
              <span className="font-mono text-xs text-muted-foreground">{oid}</span>
            </Row>
          )}
          <Row label="Ödeme Sistemi">İş Bankası 3D Secure</Row>
        </Register>
      </Room>

      <Room className="p-4 md:p-6 border-ink/20">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-ink">Olası Nedenler ve Çözüm:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kartınızın internetten alışverişe veya yurt dışı / Euro (€) işlemlerine açık olduğunu kontrol edin.</li>
              <li>Kart limitinizin rezervasyon tutarını karşıladığından emin olun.</li>
              <li>3D Secure tek kullanımlık SMS şifresini zamanında girdiğinizden emin olun.</li>
              <li>Farklı bir kredi kartı ile tekrar deneyebilirsiniz.</li>
            </ul>
          </div>
        </div>
      </Room>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/odemeler"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Tekrar Dene
        </Link>
        <Link
          href="/"
          className="btn inline-flex items-center gap-2 border border-rule hover:bg-ink/5"
        >
          <Home className="w-4 h-4" />
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

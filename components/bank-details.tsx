"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Register, Row } from "@/components/plan/register";

const IBAN = "TR88 0006 2000 4350 0006 2889 64";
const ACCOUNT_NAME = "Paşa Ege Turizm Ticaret Ltd. Şti.";

const tl = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

/**
 * Bank details and, when a price exists, the instalment schedule.
 *
 * The schedule is a register: label left, figure right, hairline between —
 * which is what a payment breakdown is. Amounts are mono and tabular so the
 * columns line up when they are read down.
 */
export function BankDetails({
  totalPrice,
  installmentPrice,
  installmentCount = 3,
}: {
  totalPrice?: number;
  installmentPrice?: number;
  installmentCount?: number;
}) {
  const [copied, setCopied] = useState<"iban" | "name" | null>(null);

  function copy(text: string, field: "iban" | "name") {
    navigator.clipboard.writeText(
      field === "iban" ? text.replace(/\s/g, "") : text,
    );
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  const hasSchedule = totalPrice != null && installmentPrice != null;

  return (
    <div className="room-plain p-4">
      <h3 className="t-sheet mb-3 text-[0.8125rem]">Banka bilgileri</h3>

      <div className="space-y-3">
        <CopyField
          label="IBAN"
          value={IBAN}
          mono
          copied={copied === "iban"}
          onCopy={() => copy(IBAN, "iban")}
        />
        <CopyField
          label="Hesap adı"
          value={ACCOUNT_NAME}
          copied={copied === "name"}
          onCopy={() => copy(ACCOUNT_NAME, "name")}
        />
      </div>

      {hasSchedule && (
        <div className="mt-5">
          <h4 className="t-note mb-2 text-muted-foreground">Taksitler</h4>
          <Register>
            {Array.from({ length: installmentCount }, (_, i) => i + 1).map((num) => {
              const amount =
                num === 1
                  ? totalPrice! - installmentPrice! * (installmentCount - 1)
                  : installmentPrice!;
              return (
                <Row key={num} label={num === 1 ? "1. taksit (kayıt)" : `${num}. taksit`}>
                  {tl.format(amount)}
                </Row>
              );
            })}
            <Row label="Toplam">{tl.format(totalPrice!)}</Row>
          </Register>
        </div>
      )}

      <p className="prose-measure mt-4 text-[0.8125rem] text-muted-foreground">
        Havale açıklamasına ad soyadınızı, paket adını ve taksit numarasını yazın.
        Dekontu bu panelden yükleyin.
      </p>
    </div>
  );
}

function CopyField({
  label,
  value,
  mono = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="t-note text-muted-foreground">{label}</p>
        <p className={`mt-1 truncate text-[0.9375rem] ${mono ? "t-data" : "t-label"}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="btn btn-secondary shrink-0 px-2.5 py-1.5"
        aria-label={`${label} kopyala`}
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="t-note">{copied ? "Kopyalandı" : "Kopyala"}</span>
      </button>
    </div>
  );
}

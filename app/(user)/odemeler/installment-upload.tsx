"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadInstallmentDekont } from "@/lib/actions/installments";

interface InstallmentUploadProps {
  installmentNumber: number;
  hasExisting: boolean;
}

export function InstallmentUpload({ installmentNumber, hasExisting }: InstallmentUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("dekont", file);

    const result = await uploadInstallmentDekont(installmentNumber, formData);

    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }

    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleUpload}
        className="hidden"
        disabled={loading}
      />
      <button
        type="button"
        className="btn btn-secondary px-3 py-1.5 text-[0.8125rem]"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
      >
        {loading ? "Yükleniyor…" : hasExisting ? "Yeniden yükle" : "Dekont yükle"}
      </button>
    </div>
  );
}

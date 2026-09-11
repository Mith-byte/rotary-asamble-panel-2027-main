"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { changeUserPackage } from "@/lib/actions/admin";

interface PackageOption {
  id: string;
  name: string;
}

interface PackageChangeProps {
  userId: string;
  currentPackageId: string | null;
  packages: PackageOption[];
}

export function PackageChange({ userId, currentPackageId, packages }: PackageChangeProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(currentPackageId ?? "");

  async function handleConfirm() {
    if (!selectedId || selectedId === currentPackageId) return;
    setLoading(true);
    setError(null);

    const result = await changeUserPackage(userId, selectedId);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className="gap-1 t-note"
        >
          <ArrowRightLeft className="w-3 h-3" />
          Paket
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-ink bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="t-label text-ink">
            Paket Değiştir
          </AlertDialogTitle>
          <AlertDialogDescription className="t-note text-muted-foreground">
            Paket değiştirildiğinde tüm dekontlar silinir ve kullanıcı odasından çıkarılır.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setError(null);
          }}
          className="w-full h-9 px-3 border bg-input border-rule font-body text-sm tracking-wider focus:border-ink focus:ring-primary/20"
        >
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}{pkg.id === currentPackageId ? " (Mevcut)" : ""}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-[11px] text-destructive t-label">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="t-note">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !selectedId || selectedId === currentPackageId}
            className="t-note"
          >
            {loading ? "Değiştiriliyor..." : "Değiştir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

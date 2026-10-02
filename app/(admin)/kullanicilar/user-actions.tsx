"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
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
import { approveUser, rejectUser } from "@/lib/actions/admin";

interface UserActionsProps {
  userId: string;
  status: "waiting" | "accepted";
}

export function UserActions({ userId, status }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const result = await approveUser(userId);
    setLoading(false);
    if (result.success) router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    const result = await rejectUser(userId);
    setLoading(false);
    if (result.success) router.refresh();
  }

  if (status === "accepted") {
    // Ödendi durumundaki kullanıcı: sadece "İptal Et" aksiyonu göster
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="xs"
            variant="outline"
            disabled={loading}
            className="gap-1 t-note border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="w-3 h-3" />
            İptal Et
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-ink bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="t-label text-ink">
              Ödemeyi İptal Et
            </AlertDialogTitle>
            <AlertDialogDescription className="t-note text-muted-foreground">
              Bu kullanıcının ödeme onayı geri alınacak ve durumu "Ödeme Bekliyor" olarak güncellenecektir.
              Emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="t-note">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="t-note bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "İşleniyor..." : "İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Ödeme bekleyen kullanıcı: "Manuel Onayla" butonu göster
  return (
    <Button
      size="xs"
      disabled={loading}
      onClick={handleApprove}
      className="gap-1 t-note"
      title="Sanal POS olmadan manuel olarak ödendi olarak işaretle"
    >
      <Check className="w-3 h-3" />
      {loading ? "..." : "Manuel Onayla"}
    </Button>
  );
}

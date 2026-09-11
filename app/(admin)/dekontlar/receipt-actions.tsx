"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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
import { approveReceipt, rejectReceipt } from "@/lib/actions/admin";

export function ReceiptActions({ installmentId }: { installmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    const result = await approveReceipt(installmentId);
    setLoading(false);
    if (result.success) router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    const result = await rejectReceipt(installmentId);
    setLoading(false);
    if (result.success) router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="xs"
        disabled={loading}
        onClick={handleApprove}
        className="gap-1 t-note"
      >
        <Check className="w-3 h-3" />
        {loading ? "..." : "Onayla"}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="xs"
            variant="outline"
            disabled={loading}
            className="gap-1 t-note border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            Reddet
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-ink bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="t-label text-ink">
              Dekontu Reddet
            </AlertDialogTitle>
            <AlertDialogDescription className="t-note text-muted-foreground">
              Bu dekont silinecek ve kullanıcının tekrar yüklemesi gerekecektir.
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="t-note">
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="t-note bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reddet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

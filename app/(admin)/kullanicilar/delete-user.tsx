"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deleteUser } from "@/lib/actions/admin";

export function DeleteUser({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteUser(userId);
    setLoading(false);
    if (result.success) router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          disabled={loading}
          className="gap-1 t-note border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3 h-3" />
          Sil
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-ink bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="t-label text-ink">
            Kullanıcıyı Sil
          </AlertDialogTitle>
          <AlertDialogDescription className="t-note text-muted-foreground">
            Kullanıcı, tüm dekontları ve oda bilgileri kalıcı olarak silinecektir. Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="t-note">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="t-note bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Siliniyor..." : "Sil"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

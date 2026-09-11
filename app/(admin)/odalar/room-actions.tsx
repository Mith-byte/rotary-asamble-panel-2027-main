"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adminRemoveMemberFromRoom,
  adminDeleteRoom,
  adminAddMemberToRoom,
} from "@/lib/actions/admin";

export function RemoveMember({ userId, roomId }: { userId: string; roomId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    const result = await adminRemoveMemberFromRoom(userId, roomId);
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
          className="gap-1 t-note border-destructive/30 text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-ink bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="t-label text-ink">
            Üyeyi Odadan Çıkar
          </AlertDialogTitle>
          <AlertDialogDescription className="t-note text-muted-foreground">
            Bu üye odadan çıkarılacak ve kendi başına yeni bir odaya yerleştirilecektir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="t-note">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={loading}
            className="t-note bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Çıkarılıyor..." : "Çıkar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await adminDeleteRoom(roomId);
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
          Odayı Sil
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-ink bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="t-label text-ink">
            Odayı Sil
          </AlertDialogTitle>
          <AlertDialogDescription className="t-note text-muted-foreground">
            Bu oda silinecek ve tüm üyeler kendi başlarına yeni odalara yerleştirilecektir.
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

interface SoloUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  club: string | null;
}

export function AddMember({ roomId, soloUsers }: { roomId: string; soloUsers: SoloUser[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleAdd(userId: string) {
    setLoading(true);
    const result = await adminAddMemberToRoom(userId, roomId);
    setLoading(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
    }
  }

  if (soloUsers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className="gap-1 t-note"
        >
          <UserPlus className="w-3 h-3" />
          Üye Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="border-ink bg-background max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="t-label text-ink">
            Odaya Üye Ekle
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <p className="t-note text-muted-foreground mb-3">
            Tek kişilik odalardaki kullanıcılar (aynı paket)
          </p>
          {soloUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-2 p-2 border border-ink hover:border-ink transition-colors"
            >
              <div className="min-w-0">
                <p className="font-display text-xs tracking-wider text-foreground truncate">
                  {user.first_name} {user.last_name}
                </p>
                {user.club && (
                  <p className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">
                    {user.club}
                  </p>
                )}
              </div>
              <Button
                size="xs"
                disabled={loading}
                onClick={() => handleAdd(user.id)}
                className="gap-1 t-note shrink-0"
              >
                {loading ? "..." : "Ekle"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

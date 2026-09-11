"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Send, MailOpen, LogOut } from "lucide-react";
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
  respondToInvitation,
  cancelInvitation,
  leaveRoom,
} from "@/lib/actions/invitations";

interface ReceivedInvitation {
  id: string;
  inviterName: string;
  inviterClub: string | null;
  roomCapacity: number;
}

interface SentInvitation {
  id: string;
  invitedName: string;
}

export function InvitationsIsland({
  received,
}: {
  received: ReceivedInvitation[];
}) {
  return (
    <div className="room-plain p-3 sm:p-5 space-y-5">
      <div className="flex items-center gap-2">
        <MailOpen className="w-4 h-4 text-ink" />
        <span className="t-note text-muted-foreground">
          Gelen Oda Davetleri
        </span>
        {received.length > 0 && (
          <span className="font-display text-[9px] text-muted-foreground ml-auto">
            {received.length} aktif
          </span>
        )}
      </div>

      <div className="border-t border-rule" />

      {received.length > 0 ? (
        <ReceivedSection invitations={received} />
      ) : (
        <p className="t-note text-muted-foreground">
          Henüz davet yok
        </p>
      )}
    </div>
  );
}

export function SentInvitations({
  invitations,
}: {
  invitations: SentInvitation[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleCancel(invitationId: string) {
    setLoadingId(invitationId);
    setError(null);

    const result = await cancelInvitation(invitationId);

    setLoadingId(null);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {error && (
        <p className="text-destructive text-xs t-label">
          {error}
        </p>
      )}

      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="room-plain p-3 sm:p-4"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 border border-ink flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="t-label text-foreground truncate">
                {inv.invitedName}
              </p>
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                Davet Beklemede
              </p>
            </div>
            <Button
              size="xs"
              variant="outline"
              disabled={loadingId === inv.id}
              onClick={() => handleCancel(inv.id)}
              className="shrink-0 t-note border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              İptal
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

export function LeaveRoomButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave() {
    setLoading(true);
    setError(null);

    const result = await leaveRoom();

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <AlertDialog>
      {error && (
        <p className="text-destructive text-xs t-label mb-2">
          {error}
        </p>
      )}
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="gap-1.5 t-note border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          {loading ? "Ayrılıyor..." : "Odadan Ayrıl"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-ink bg-background">
        <AlertDialogHeader>
          <AlertDialogTitle className="t-label text-ink">
            Odadan Ayrıl
          </AlertDialogTitle>
          <AlertDialogDescription className="t-note text-muted-foreground">
            Odadan ayrılmak istediğinize emin misiniz? Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="t-note">
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeave}
            className="t-note bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ayrıl
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReceivedSection({
  invitations,
}: {
  invitations: ReceivedInvitation[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(invitationId: string, accept: boolean) {
    setLoadingId(invitationId);
    setError(null);

    const result = await respondToInvitation(invitationId, accept);

    setLoadingId(null);

    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-destructive text-xs t-label">
          {error}
        </p>
      )}

      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="border border-ink p-3 flex items-center gap-3 sm:gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="t-label text-foreground truncate">
              {inv.inviterName}
            </p>
            {inv.inviterClub && (
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                {inv.inviterClub}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground t-label mt-0.5">
              {inv.roomCapacity} kişilik oda
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={loadingId === inv.id}
              onClick={() => handleRespond(inv.id, false)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon-sm"
              disabled={loadingId === inv.id}
              onClick={() => handleRespond(inv.id, true)}
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

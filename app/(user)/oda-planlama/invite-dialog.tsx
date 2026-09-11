"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendRoomInvitation } from "@/lib/actions/invitations";

export function InviteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const result = await sendRoomInvitation(email.trim());

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      router.refresh();
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail("");
      setSent(false);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 t-note">
          <UserPlus className="w-3.5 h-3.5" />
          Davet Et
        </Button>
      </DialogTrigger>
      <DialogContent className="border-ink bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-lg tracking-wider text-ink">
            Oda Arkadaşı Davet Et
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-4">
            <p className="t-note text-muted-foreground">
              Kullanıcı kayıtlıysa davet gönderildi.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 t-note"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Başka Davet Gönder
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="t-note text-muted-foreground mb-1.5 block">
                E-posta Adresi
              </label>
              <Input
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-destructive text-xs t-label">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full t-note"
            >
              {loading ? "Gönderiliyor..." : "Davet Gönder"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

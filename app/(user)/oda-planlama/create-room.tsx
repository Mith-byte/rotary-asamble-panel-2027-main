"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ensureRoom } from "@/lib/actions/rooms";

/**
 * Creates the room a multi-occupancy package is entitled to.
 *
 * The room is normally created with the registration. This exists for the case
 * where that write did not land — the registrant can recover it themselves
 * instead of being told to contact the district about a package that is
 * perfectly correct.
 */
export function CreateRoomButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const result = await ensureRoom();
          if (result?.error) setError(result.error);
          else router.refresh();
          setLoading(false);
        }}
      >
        {loading ? "Kuruluyor…" : "Odanızı kurun"}
      </button>
    </div>
  );
}

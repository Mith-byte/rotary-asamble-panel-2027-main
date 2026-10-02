/**
 * Registration state, drawn rather than coloured.
 *
 * Accepted is poché — filled, settled. Waiting is drawn dashed — set out but
 * not yet filled in. Ink carries both; there is no green success and no amber
 * pending, because a hue on this panel names a discipline or a package axis
 * and nothing else.
 */
export function StateBadge({ status }: { status: string | null }) {
  const accepted = status === "accepted";
  return (
    <span className="state t-note" data-state={accepted ? "accepted" : "waiting"}>
      {accepted ? "Ödendi" : "Ödeme Bekliyor"}
    </span>
  );
}

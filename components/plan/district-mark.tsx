import Image from "next/image";
import { event } from "@/lib/event";

/**
 * The district's mark, locked up with the panel's name.
 *
 * Four official variants exist. Which one is used is decided by the ground it
 * sits on, not by preference:
 *   ground "paper" → the official mark, Rotary blue wordmark + gold wheel
 *   ground "ink"   → the white wordmark, so the type reads against poché
 *
 * The mark's own gold is exempt from the rule that gold means "this one is
 * yours": it belongs to the mark, at logo scale, in fixed chrome — a reader
 * does not confuse a logo with a state marker. Nothing else on the screen may
 * borrow it.
 */
const SRC = {
  paper: "/rotary-2440.png",
  ink: "/rotary-2440-on-ink.png",
} as const;

export function DistrictMark({
  ground = "paper",
  className = "",
  width = 132,
}: {
  ground?: keyof typeof SRC;
  className?: string;
  width?: number;
}) {
  return (
    <Image
      src={SRC[ground]}
      alt={`${event.district} — ${event.name}`}
      width={2593}
      height={1124}
      priority
      style={{ width, height: "auto" }}
      className={className}
    />
  );
}

/** Mark plus the panel's name, for a header or a title block. */
export function MarkLockup({ ground = "ink" }: { ground?: keyof typeof SRC }) {
  return (
    <span className="flex flex-col gap-2.5">
      <DistrictMark ground={ground} width={116} />
      <span className="t-sheet text-[0.9375rem] leading-none">Kayıt Paneli</span>
    </span>
  );
}

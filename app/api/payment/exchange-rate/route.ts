import { NextResponse } from "next/server";
import { getEuroExchangeRate } from "@/lib/exchange-rate";

export const dynamic = "force-dynamic";
export const revalidate = 900; // 15 dakika

export async function GET() {
  const rateInfo = await getEuroExchangeRate();
  return NextResponse.json(rateInfo, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
    },
  });
}

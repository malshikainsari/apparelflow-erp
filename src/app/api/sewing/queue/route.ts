import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSewingQueue } from "@/lib/sewing";

// No request object, no query params: nothing a client sends can widen this query.
export async function GET() {
  const auth = await requireRole("sewing_supervisor");
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getSewingQueue());
}
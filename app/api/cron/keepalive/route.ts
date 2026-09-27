import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/db/admin";

/** A daily, uncached DB read (P0-4). Never returns player data. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const headers = { "Cache-Control": "no-store" };
  if (
    !secret ||
    authorization.length !== expected.length ||
    !timingSafeEqual(authorization, expected)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const { error } = await adminDb().from("groups").select("id").limit(1);
    if (error) throw new Error("Database read failed");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Database unavailable" },
      { status: 503, headers },
    );
  }
}

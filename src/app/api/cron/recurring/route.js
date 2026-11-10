import { timingSafeEqual } from "node:crypto";
import { runDueSchedules } from "@/lib/data/recurring";

export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called once a day by Vercel Cron (see vercel.json), which sends
// "Authorization: Bearer $CRON_SECRET". Issues every recurring invoice that is
// due. Running it more than once is harmless.
export async function GET(request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const result = await runDueSchedules();
  return Response.json(
    {
      date: result.today,
      issued: result.created.map((invoice) => invoice.number),
      failed: result.errors.length,
    },
    { status: result.errors.length > 0 ? 500 : 200 }
  );
}

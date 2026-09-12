import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSupabase } from "@/lib/supabase";

/**
 * Pull daily clicks/impressions from Search Console into gsc_daily so the
 * admin dashboard can chart them.
 *
 * Setup (one-time):
 *  1. Google Cloud console → create a service account → create a JSON key.
 *  2. Search Console → Settings → Users and permissions → add the service
 *     account email as a Full or Restricted user.
 *  3. Vercel env:
 *       GSC_SERVICE_ACCOUNT_JSON = the whole JSON key, one line
 *       GSC_SITE_URL             = sc-domain:invoicetodata.com
 *                                  (or https://www.invoicetodata.com/)
 *
 * Until those exist this route no-ops, and the dashboard shows
 * "Search Console not connected yet" instead of breaking.
 *
 * GSC data lags ~2–3 days, so every run re-fetches a trailing window and
 * upserts — late-arriving numbers correct themselves.
 */

const LOOKBACK_DAYS = 30;

export async function runGscDaily(): Promise<{ imported: number; skipped?: string }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const siteUrl = process.env.GSC_SITE_URL;
  if (!raw || !siteUrl) {
    return { imported: 0, skipped: "GSC_SERVICE_ACCOUNT_JSON / GSC_SITE_URL not set" };
  }

  let creds: { client_email?: string; private_key?: string };
  try {
    creds = JSON.parse(raw);
  } catch {
    return { imported: 0, skipped: "GSC_SERVICE_ACCOUNT_JSON is not valid JSON" };
  }
  if (!creds.client_email || !creds.private_key) {
    return { imported: 0, skipped: "service account JSON missing client_email/private_key" };
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    // Vercel env vars store newlines escaped; restore them for the PEM parser.
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 3600_000);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["date"],
      rowLimit: 500,
    },
  });

  const rows = res.data.rows ?? [];
  if (rows.length === 0) return { imported: 0 };

  const payload = rows.map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: r.ctr ?? 0,
    position: r.position ?? null,
    imported_at: new Date().toISOString(),
  })).filter((r) => r.date);

  const admin = getSupabase();
  const { error } = await admin.from("gsc_daily").upsert(payload, { onConflict: "date" });
  if (error) throw new Error(`gsc_daily upsert failed: ${error.message}`);

  return { imported: payload.length };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runGscDaily());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GSC Daily] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

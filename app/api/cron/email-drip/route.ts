import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { dripEmail, hasEmailConfig, sendEmail, type DripType } from "@/lib/email";

/**
 * Daily onboarding drip (runs from the master cron):
 *   day 0+ → welcome        (signups < 7 days old)
 *   day 2+ → case_study     (signups < 14 days old)
 *   day 5+ → founding_offer (signups < 30 days old)
 *
 * Users older than each window never get that email — this avoids blasting
 * the existing user base with automated mail they didn't expect. (Reach the
 * old power users manually — see extractions table for who they are.)
 *
 * Sent emails are recorded in email_log (unique user_id+email_type), so the
 * cron is idempotent. Users with email_opt_out are skipped entirely.
 */

const MAX_SENDS_PER_RUN = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const STAGES: Array<{ type: DripType; minAgeDays: number; maxAgeDays: number }> = [
  { type: "welcome", minAgeDays: 0, maxAgeDays: 7 },
  { type: "case_study", minAgeDays: 2, maxAgeDays: 14 },
  { type: "founding_offer", minAgeDays: 5, maxAgeDays: 30 },
];

export async function runEmailDrip(): Promise<{
  sent: number;
  skipped: string;
  byType: Record<string, number>;
}> {
  if (!hasEmailConfig()) {
    return { sent: 0, skipped: "email not configured (RESEND_API_KEY / EMAIL_FROM)", byType: {} };
  }

  const admin = getSupabase();

  // Recent signups via the auth admin API (has reliable email + created_at).
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);

  const now = Date.now();
  const candidates = usersPage.users.filter((u) => {
    if (!u.email || !u.email_confirmed_at) return false;
    const age = now - new Date(u.created_at).getTime();
    return age < 30 * DAY_MS;
  });

  if (candidates.length === 0) {
    return { sent: 0, skipped: "no recent signups", byType: {} };
  }

  const ids = candidates.map((u) => u.id);
  const [{ data: logRows }, { data: optOutRows }] = await Promise.all([
    admin.from("email_log").select("user_id, email_type").in("user_id", ids),
    admin.from("users").select("id").in("id", ids).eq("email_opt_out", true),
  ]);

  const alreadySent = new Set(
    (logRows ?? []).map((r) => `${(r as { user_id: string }).user_id}:${(r as { email_type: string }).email_type}`)
  );
  const optedOut = new Set((optOutRows ?? []).map((r) => (r as { id: string }).id));

  let sent = 0;
  const byType: Record<string, number> = {};

  for (const user of candidates) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    if (optedOut.has(user.id)) continue;
    const ageDays = (now - new Date(user.created_at).getTime()) / DAY_MS;

    for (const stage of STAGES) {
      if (sent >= MAX_SENDS_PER_RUN) break;
      if (ageDays < stage.minAgeDays || ageDays >= stage.maxAgeDays) continue;
      if (alreadySent.has(`${user.id}:${stage.type}`)) continue;

      // Claim the log row first — if another run raced us, the unique
      // constraint makes the insert fail and we skip the send.
      const { error: claimError } = await admin
        .from("email_log")
        .insert({ user_id: user.id, email_type: stage.type });
      if (claimError) continue;

      const { subject, html, text } = dripEmail(stage.type, user.id);
      const ok = await sendEmail({ to: user.email!, subject, html, text });
      if (ok) {
        sent += 1;
        byType[stage.type] = (byType[stage.type] ?? 0) + 1;
      } else {
        // Send failed — release the claim so tomorrow's run retries.
        await admin
          .from("email_log")
          .delete()
          .eq("user_id", user.id)
          .eq("email_type", stage.type);
      }
      break; // at most one email per user per run — keeps the cadence gentle
    }
  }

  return { sent, skipped: "", byType };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runEmailDrip();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email Drip] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

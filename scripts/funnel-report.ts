/**
 * Conversion-funnel report from production data.
 * Usage: npx tsx --env-file=<env> scripts/funnel-report.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Row = Record<string, unknown>;

async function main() {
  // ── Extractions (server-side usage log, live since ~Aug 23) ──────────────
  const { data: ext, error } = await supabase
    .from("extractions")
    .select("user_id, guest_key, ip, tool, status, plan, created_at")
    .order("created_at", { ascending: true })
    .limit(50000);
  if (error) throw new Error("extractions: " + error.message);
  const rows = (ext ?? []) as Row[];

  const success = rows.filter((r) => r.status === "success");
  const failed = rows.filter((r) => r.status === "failed");
  const guestRows = success.filter((r) => !r.user_id);
  const userRows = success.filter((r) => r.user_id);

  const byTool: Record<string, number> = {};
  for (const r of success) byTool[String(r.tool)] = (byTool[String(r.tool)] ?? 0) + 1;

  const guestKeys = new Set(guestRows.map((r) => r.guest_key).filter(Boolean));
  const guestIps = new Set(guestRows.map((r) => r.ip).filter(Boolean));
  const userIds = new Set(userRows.map((r) => r.user_id));

  // Guests who came back for more after the 1 free (denials aren't logged,
  // but a 2nd+ SUCCESS attempt from same key/ip means they got around it or
  // failed attempts recorded — approximate demand pressure by IPs with 2+ successes)
  const ipCounts: Record<string, number> = {};
  for (const r of guestRows) if (r.ip) ipCounts[String(r.ip)] = (ipCounts[String(r.ip)] ?? 0) + 1;
  const guestsAtLimit = Object.values(ipCounts).filter((c) => c >= 1).length;
  const guestsMultiIp = Object.values(ipCounts).filter((c) => c >= 2).length;

  const userCounts: Record<string, number> = {};
  for (const r of userRows) userCounts[String(r.user_id)] = (userCounts[String(r.user_id)] ?? 0) + 1;
  const usersAt3Plus = Object.entries(userCounts).filter(([, c]) => c >= 3);
  const usersAtExactly = (n: number) => Object.values(userCounts).filter((c) => c === n).length;

  // Daily trend (last 14 days)
  const daily: Record<string, number> = {};
  for (const r of success) {
    const d = String(r.created_at).slice(0, 10);
    daily[d] = (daily[d] ?? 0) + 1;
  }

  console.log("=== EXTRACTIONS (since server logging began) ===");
  console.log(`total attempts: ${rows.length} | success: ${success.length} | failed: ${failed.length}`);
  console.log(`guest successes: ${guestRows.length} (distinct cookies: ${guestKeys.size}, distinct IPs: ${guestIps.size})`);
  console.log(`logged-in successes: ${userRows.length} (distinct users: ${userIds.size})`);
  console.log("by tool:", JSON.stringify(byTool));
  console.log(`guest IPs that used their free conversion: ${guestsAtLimit}; IPs with 2+ guest successes: ${guestsMultiIp}`);
  console.log(`logged-in users with 1 / 2 / 3+ extractions: ${usersAtExactly(1)} / ${usersAtExactly(2)} / ${usersAt3Plus.length}`);
  console.log("last 14 days:", JSON.stringify(Object.fromEntries(Object.entries(daily).slice(-14))));

  // ── Users & plans ─────────────────────────────────────────────────────────
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, credits, plan, pages_used, email_opt_out, created_at")
    .limit(10000);
  const u = (allUsers ?? []) as Row[];
  const planCount: Record<string, number> = {};
  for (const r of u) planCount[String(r.plan ?? "null")] = (planCount[String(r.plan ?? "null")] ?? 0) + 1;
  const withCredits = u.filter((r) => Number(r.credits) > 0).length;
  const usedAllFree = u.filter((r) => String(r.plan) === "free" && Number(r.pages_used) >= 3).length;
  const newSinceLaunch = u.filter((r) => String(r.created_at) >= "2026-08-22").length;

  console.log("\n=== USERS ===");
  console.log(`total user rows: ${u.length} | new since 2026-08-22: ${newSinceLaunch}`);
  console.log("plans:", JSON.stringify(planCount));
  console.log(`with leftover credits: ${withCredits} | free users at 3/3 monthly quota: ${usedAllFree}`);

  // ── Transactions (has ANYONE even reached a completed checkout?) ─────────
  const { data: tx } = await supabase
    .from("transactions")
    .select("created_at, amount_usd, credits_added, status")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("\n=== TRANSACTIONS ===");
  console.log(`rows: ${tx?.length ?? 0}`);
  for (const t of tx ?? []) console.log(" ", t.created_at, t.amount_usd, t.status);

  // ── Email drip ────────────────────────────────────────────────────────────
  const { data: emails } = await supabase.from("email_log").select("email_type, sent_at").limit(5000);
  const byType: Record<string, number> = {};
  for (const e of (emails ?? []) as Row[]) byType[String(e.email_type)] = (byType[String(e.email_type)] ?? 0) + 1;
  console.log("\n=== EMAIL DRIP ===");
  console.log("sent:", JSON.stringify(byType));

  // ── Power users (the manual-outreach list) ───────────────────────────────
  console.log("\n=== POWER USERS (3+ successful extractions) ===");
  if (usersAt3Plus.length > 0) {
    const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map((authList?.users ?? []).map((au) => [au.id, au.email]));
    for (const [uid, count] of usersAt3Plus.sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${count}x  ${emailById.get(uid) ?? uid}`);
    }
  } else {
    console.log("  (none)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

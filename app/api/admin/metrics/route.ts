import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabase } from "@/lib/supabase";

/** Per-million-token prices, used to turn logged usage into a cost figure. */
const MODEL_RATES: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-5": { in: 3, out: 15 },
};

type Row = Record<string, unknown>;

function dayKey(iso: string): string {
  return String(iso).slice(0, 10);
}

function emptyDays(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 7), 90);
  const dates = emptyDays(days);
  const since = new Date(Date.now() - days * 2 * 24 * 3600_000).toISOString(); // 2x window for deltas
  const windowStart = dates[0]!;

  const admin = getSupabase();

  const [extRes, gscRes, usersRes, txRes, authRes] = await Promise.all([
    admin
      .from("extractions")
      .select("user_id, guest_key, tool, status, plan, error_code, duration_ms, pages_total, model, input_tokens, output_tokens, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50000),
    admin.from("gsc_daily").select("date, clicks, impressions, position").gte("date", dates[0]!),
    admin.from("users").select("id, plan, credits, created_at").limit(10000),
    admin.from("transactions").select("created_at, amount_usd, status").limit(5000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const ext = (extRes.data ?? []) as Row[];
  const gsc = (gscRes.data ?? []) as Row[];
  const users = (usersRes.data ?? []) as Row[];
  const tx = (txRes.data ?? []) as Row[];
  const authUsers = authRes.data?.users ?? [];

  // ── Daily series ──────────────────────────────────────────────────────────
  const byDate = new Map<string, {
    date: string;
    success: number;
    failed: number;
    excel: number;
    bank: number;
    gsheet: number;
    signups: number;
    impressions: number;
    clicks: number;
  }>();
  for (const d of dates) {
    byDate.set(d, { date: d, success: 0, failed: 0, excel: 0, bank: 0, gsheet: 0, signups: 0, impressions: 0, clicks: 0 });
  }

  const inWindow = ext.filter((r) => dayKey(String(r.created_at)) >= windowStart);
  const prevWindow = ext.filter((r) => dayKey(String(r.created_at)) < windowStart);

  for (const r of inWindow) {
    const bucket = byDate.get(dayKey(String(r.created_at)));
    if (!bucket) continue;
    if (r.status === "success") {
      bucket.success += 1;
      const tool = String(r.tool);
      if (tool.includes("bank")) bucket.bank += 1;
      else if (tool.includes("gsheet")) bucket.gsheet += 1;
      else bucket.excel += 1;
    } else {
      bucket.failed += 1;
    }
  }

  for (const u of authUsers) {
    const bucket = byDate.get(dayKey(u.created_at));
    if (bucket) bucket.signups += 1;
  }

  for (const g of gsc) {
    const bucket = byDate.get(String(g.date));
    if (bucket) {
      bucket.impressions = Number(g.impressions) || 0;
      bucket.clicks = Number(g.clicks) || 0;
    }
  }

  const daily = dates.map((d) => byDate.get(d)!);

  // ── Totals + previous-window deltas ───────────────────────────────────────
  const successNow = inWindow.filter((r) => r.status === "success").length;
  const failedNow = inWindow.filter((r) => r.status === "failed").length;
  const successPrev = prevWindow.filter((r) => r.status === "success").length;
  const failedPrev = prevWindow.filter((r) => r.status === "failed").length;

  const signupsNow = authUsers.filter((u) => dayKey(u.created_at) >= windowStart).length;
  const signupsPrev = authUsers.filter((u) => {
    const k = dayKey(u.created_at);
    return k < windowStart && k >= dayKey(since);
  }).length;

  const rate = (s: number, f: number) => (s + f === 0 ? null : Math.round((s / (s + f)) * 1000) / 10);

  // ── Funnel (window) ───────────────────────────────────────────────────────
  const impressionsTotal = daily.reduce((a, d) => a + d.impressions, 0);
  const clicksTotal = daily.reduce((a, d) => a + d.clicks, 0);
  const distinctVisitors = new Set(
    inWindow.map((r) => r.user_id ?? r.guest_key).filter(Boolean)
  ).size;
  const paidUsers = users.filter((u) => ["week_pass", "pro", "pro_yearly"].includes(String(u.plan))).length;

  const funnel = [
    { stage: "Search impressions", count: impressionsTotal },
    { stage: "Search clicks", count: clicksTotal },
    { stage: "People who converted a file", count: distinctVisitors },
    { stage: "Signed up", count: signupsNow },
    { stage: "Paid", count: paidUsers },
  ];

  // ── Failure breakdown ─────────────────────────────────────────────────────
  const errorCounts: Record<string, number> = {};
  for (const r of inWindow) {
    if (r.status !== "failed") continue;
    const code = String(r.error_code ?? "unknown");
    errorCounts[code] = (errorCounts[code] ?? 0) + 1;
  }
  const errors = Object.entries(errorCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  // ── Latency + cost (only rows with telemetry) ────────────────────────────
  const durations = inWindow
    .map((r) => Number(r.duration_ms))
    .filter((n) => Number.isFinite(n) && n > 0);

  let costUsd = 0;
  let costedRows = 0;
  for (const r of inWindow) {
    const rates = MODEL_RATES[String(r.model)];
    const i = Number(r.input_tokens);
    const o = Number(r.output_tokens);
    if (!rates || !Number.isFinite(i) || !Number.isFinite(o)) continue;
    costUsd += (i / 1_000_000) * rates.in + (o / 1_000_000) * rates.out;
    costedRows += 1;
  }

  // ── Revenue ───────────────────────────────────────────────────────────────
  const revenueWindow = tx
    .filter((t) => t.status === "completed" && dayKey(String(t.created_at)) >= windowStart)
    .reduce((a, t) => a + (Number(t.amount_usd) || 0), 0);

  // ── Power users (manual-outreach list) ───────────────────────────────────
  const perUser: Record<string, number> = {};
  for (const r of inWindow) {
    if (!r.user_id || r.status !== "success") continue;
    perUser[String(r.user_id)] = (perUser[String(r.user_id)] ?? 0) + 1;
  }
  const emailById = new Map(authUsers.map((u) => [u.id, u.email]));
  const powerUsers = Object.entries(perUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ email: emailById.get(id) ?? id.slice(0, 8), count }));

  return NextResponse.json({
    days,
    daily,
    totals: {
      extractions: { now: successNow + failedNow, prev: successPrev + failedPrev },
      success: { now: successNow, prev: successPrev },
      failed: { now: failedNow, prev: failedPrev },
      successRate: { now: rate(successNow, failedNow), prev: rate(successPrev, failedPrev) },
      signups: { now: signupsNow, prev: signupsPrev },
      impressions: impressionsTotal,
      clicks: clicksTotal,
      revenueUsd: Math.round(revenueWindow * 100) / 100,
      paidUsers,
      totalUsers: authUsers.length,
    },
    funnel,
    errors,
    latency: {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      samples: durations.length,
    },
    cost: {
      usd: Math.round(costUsd * 10000) / 10000,
      samples: costedRows,
      perExtraction: costedRows > 0 ? Math.round((costUsd / costedRows) * 10000) / 10000 : null,
    },
    powerUsers,
    gscConnected: gsc.length > 0,
  });
}

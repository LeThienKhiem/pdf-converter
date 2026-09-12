import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { runInformational } from "@/app/api/cron/seo-content/route";
import { runBuyerIntent } from "@/app/api/cron/seo-content-2/route";
import { runContentRefresh } from "@/app/api/cron/content-refresh/route";
import { runEmailDrip } from "@/app/api/cron/email-drip/route";
import { runGscDaily } from "@/app/api/cron/gsc-daily/route";
import { runBacklinkTasks } from "@/app/api/cron/backlink-tasks/route";
import { runSyndicate } from "@/app/api/cron/syndicate/route";

/**
 * Master cron — the ONLY entry registered in vercel.json (Vercel Hobby
 * limits us to one schedule). Dispatches the right sub-runner based on
 * day of week so we still cover the full content calendar with a single
 * daily tick.
 *
 * Rotation (UTC day):
 *   Sun (0) → content-refresh (weekly maintenance of stale posts)
 *   Mon (1) → informational seo-content
 *   Tue (2) → buyer-intent seo-content-2
 *   Wed (3) → informational seo-content
 *   Thu (4) → buyer-intent seo-content-2
 *   Fri (5) → informational seo-content
 *   Sat (6) → buyer-intent seo-content-2
 *
 * Net cadence: 3 informational + 3 buyer-intent + 1 refresh per week.
 *
 * Manual trigger of a specific runner is still supported via the original
 * sub-routes (e.g. /api/cron/seo-content) — they remain as thin wrappers
 * around the same exported runners.
 *
 * Override for testing: append ?task=informational|buyer-intent|refresh
 * to force a specific runner regardless of weekday. Auth still required.
 */

type TaskName = "informational" | "buyer-intent" | "refresh";

function pickTaskForDay(dayOfWeek: number): TaskName {
  // 0 = Sunday in JS getUTCDay(); see rotation table above.
  if (dayOfWeek === 0) return "refresh";
  // Odd weekdays → informational, even → buyer-intent.
  return dayOfWeek % 2 === 1 ? "informational" : "buyer-intent";
}

async function dispatch(task: TaskName) {
  switch (task) {
    case "informational":
      return await runInformational();
    case "buyer-intent":
      return await runBuyerIntent();
    case "refresh":
      return await runContentRefresh();
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const override = url.searchParams.get("task") as TaskName | null;
    const validOverride =
      override === "informational" || override === "buyer-intent" || override === "refresh"
        ? override
        : null;

    const day = new Date().getUTCDay();
    const task = validOverride ?? pickTaskForDay(day);

    console.log(
      `[Master Cron] day=${day} task=${task}${validOverride ? " (overridden)" : ""}`
    );

    const result = await dispatch(task);

    // Onboarding email drip runs every day alongside the content task.
    let emailDrip: unknown = null;
    try {
      emailDrip = await runEmailDrip();
    } catch (dripErr) {
      console.error("[Master Cron] Email drip failed:", dripErr);
      emailDrip = { error: dripErr instanceof Error ? dripErr.message : "failed" };
    }

    // Search Console daily rollup for the /admin dashboard. No-ops until the
    // GSC service account is configured.
    let gsc: unknown = null;
    try {
      gsc = await runGscDaily();
    } catch (gscErr) {
      console.error("[Master Cron] GSC daily failed:", gscErr);
      gsc = { error: gscErr instanceof Error ? gscErr.message : "failed" };
    }

    // Backlink reminders, Mondays only.
    //
    // /api/cron/backlink-tasks was never registered in vercel.json and never
    // dispatched from here, so it had never fired — ten prepared submissions
    // (Product Hunt, AlternativeTo, G2, Show HN and the rest) sat unused.
    //
    // Worth wiring because it addresses the one gap on-page work cannot.
    // Search Console shows 2697 impressions — 55% of measured demand — stuck
    // at positions 41 to 87 on head commercial terms against ABBYY, Rossum
    // and Nanonets. That is a domain-authority contest, and off-site links are
    // the only lever that reaches it.
    let backlinks: unknown = null;
    if (day === 1) {
      try {
        backlinks = await runBacklinkTasks();
      } catch (blErr) {
        console.error("[Master Cron] Backlink tasks failed:", blErr);
        backlinks = { error: blErr instanceof Error ? blErr.message : "failed" };
      }
    }

    // Syndication, every day — this is the one backlink source that is fully
    // automatable without asking anyone's permission, because it publishes our
    // own content to our own accounts with a canonical URL pointing back here.
    //
    // Was dead code: written, never registered in vercel.json, never dispatched
    // from here. One post per run works through a 120-post backlog that had
    // never been syndicated, which is months of daily links from articles that
    // already exist.
    let syndication: unknown = null;
    try {
      syndication = await runSyndicate();
    } catch (synErr) {
      console.error("[Master Cron] Syndication failed:", synErr);
      syndication = { error: synErr instanceof Error ? synErr.message : "failed" };
    }

    return NextResponse.json({
      master: { day, task, overridden: !!validOverride },
      result,
      emailDrip,
      gsc,
      backlinks,
      syndication,
    });
  } catch (err) {
    console.error("[Master Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(
      `❌ <b>Master Cron Failed</b>\n\nError: ${message}\n\nNext tick will try the next-day task.`
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

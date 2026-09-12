import { sendTelegramMessage } from "@/lib/telegram";
import { getSupabase } from "@/lib/supabase";

/**
 * Revenue alerts to Telegram.
 *
 * The first paying customer is the single event worth interrupting the day
 * for, so payments alert instantly from the Paddle webhook rather than
 * waiting for a daily digest. Cancellations alert too — churn on a tiny
 * subscriber base is just as urgent as a sale.
 *
 * Every function here is best-effort: a Telegram outage must never fail a
 * webhook, because Paddle would retry it and the customer's plan is already
 * applied by then.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** How many completed payments exist, so the first one can be celebrated. */
async function completedPaymentCount(): Promise<number | null> {
  try {
    const admin = getSupabase();
    const { count, error } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed");
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

export async function alertPayment(params: {
  kind: string;
  amountUsd: number | null;
  userId: string;
  email?: string | null;
}): Promise<void> {
  try {
    const labels: Record<string, string> = {
      week_pass: "Week Pass ($2, 7 days)",
      pro: "Pro subscription ($5/mo)",
      pro_yearly: "Pro Yearly ($39/yr)",
      pro_founding: "Founding Member ($3/mo for life)",
      credits50: "50-credit pack ($9.99)",
      unknown: "Purchase",
    };

    const n = await completedPaymentCount();
    const isFirst = n === 1;
    const amount = params.amountUsd != null ? `$${params.amountUsd.toFixed(2)}` : "—";
    const who = params.email ? esc(params.email) : `user ${params.userId.slice(0, 8)}`;

    const header = isFirst
      ? "🎉🎉 <b>FIRST PAYING CUSTOMER</b> 🎉🎉"
      : "💰 <b>New payment</b>";

    const lines = [
      header,
      "",
      `<b>${esc(labels[params.kind] ?? labels.unknown!)}</b>`,
      `Amount: <b>${amount}</b>`,
      `Customer: ${who}`,
    ];
    if (n != null && !isFirst) lines.push(`Total paid orders: ${n}`);
    lines.push("", "https://www.invoicetodata.com/admin");

    await sendTelegramMessage(lines.join("\n"));
  } catch (err) {
    console.error("[SalesAlert] payment alert failed:", err);
  }
}

export async function alertCancellation(params: {
  userId: string | null;
  email?: string | null;
  eventType: string;
}): Promise<void> {
  try {
    const who = params.email
      ? esc(params.email)
      : params.userId
        ? `user ${params.userId.slice(0, 8)}`
        : "unknown user";
    await sendTelegramMessage(
      [
        "⚠️ <b>Subscription ended</b>",
        "",
        `Customer: ${who}`,
        `Reason: ${esc(params.eventType)}`,
        "",
        "Worth a short personal email asking why.",
      ].join("\n")
    );
  } catch (err) {
    console.error("[SalesAlert] cancellation alert failed:", err);
  }
}

/**
 * Once-a-day health line from the master cron. Stays silent on a quiet day —
 * it only speaks when yesterday had activity or a problem, so a message in
 * the chat always means something happened.
 */
export async function alertDailyHealth(): Promise<{ sent: boolean; reason?: string }> {
  try {
    const admin = getSupabase();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();

    const [extRes, txRes] = await Promise.all([
      admin.from("extractions").select("status, error_code").gte("created_at", since),
      admin
        .from("transactions")
        .select("amount_usd")
        .eq("status", "completed")
        .gte("created_at", since),
    ]);

    const rows = extRes.data ?? [];
    const success = rows.filter((r) => r.status === "success").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const orders = txRes.data ?? [];
    const total = success + failed;

    // Nothing happened and nothing broke — say nothing.
    if (total === 0 && orders.length === 0) return { sent: false, reason: "quiet day" };

    const rate = total > 0 ? Math.round((success / total) * 100) : null;
    const unhealthy = rate != null && rate < 90;

    const topError = (() => {
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (r.status !== "failed") continue;
        const code = String(r.error_code ?? "unknown");
        counts[code] = (counts[code] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return top ? `${top[0]} ×${top[1]}` : null;
    })();

    const lines = [
      unhealthy ? "🔴 <b>Daily health — needs a look</b>" : "📊 <b>Daily health</b>",
      "",
      `Conversions: <b>${success}</b>${failed > 0 ? ` (${failed} failed)` : ""}`,
    ];
    if (rate != null) lines.push(`Success rate: <b>${rate}%</b>${unhealthy ? " ⚠️ below 90%" : ""}`);
    if (topError) lines.push(`Top failure: ${esc(topError)}`);
    if (orders.length > 0) {
      const revenue = orders.reduce((a, o) => a + (Number(o.amount_usd) || 0), 0);
      lines.push(`Orders: <b>${orders.length}</b> · $${revenue.toFixed(2)}`);
    }
    lines.push("", "https://www.invoicetodata.com/admin");

    const ok = await sendTelegramMessage(lines.join("\n"));
    return { sent: ok };
  } catch (err) {
    console.error("[SalesAlert] daily health failed:", err);
    return { sent: false, reason: "error" };
  }
}

/** Look up an email for nicer alerts; never throws. */
export async function emailForUser(userId: string): Promise<string | null> {
  try {
    const admin = getSupabase();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

import { createHmac } from "crypto";

/**
 * Transactional email via the Resend HTTP API (no SDK dependency).
 * Env: RESEND_API_KEY, EMAIL_FROM (e.g. `InvoiceToData <hello@invoicetodata.com>`).
 * Emails silently no-op when RESEND_API_KEY is missing so the cron never crashes.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function hasEmailConfig(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** HMAC token so unsubscribe links can't be forged for other users. */
export function unsubscribeToken(userId: string): string {
  const secret = process.env.CRON_SECRET ?? "";
  return createHmac("sha256", secret).update(`unsub:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return Boolean(token) && unsubscribeToken(userId) === token;
}

export function unsubscribeUrl(userId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.invoicetodata.com";
  return `${siteUrl}/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${unsubscribeToken(userId)}`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[Email] RESEND_API_KEY / EMAIL_FROM not set — skipping send");
    return false;
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[Email] Resend error:", res.status, body.slice(0, 300));
    return false;
  }
  return true;
}

// ── Drip templates ──────────────────────────────────────────────────────────

const SITE = "https://www.invoicetodata.com";

function layout(inner: string, userId: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6;">
    ${inner}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;" />
    <p style="font-size:12px;color:#94a3b8;">
      InvoiceToData — AI invoice &amp; bank statement OCR.<br/>
      Don't want these emails? <a href="${unsubscribeUrl(userId)}" style="color:#94a3b8;">Unsubscribe</a>.
    </p>
  </div>`;
}

export type DripType = "welcome" | "case_study" | "founding_offer";

export function dripEmail(type: DripType, userId: string): { subject: string; html: string } {
  switch (type) {
    case "welcome":
      return {
        subject: "Your 3 free pages are ready — here's how to use them well",
        html: layout(
          `
          <h2 style="margin:0 0 12px;">Welcome to InvoiceToData 👋</h2>
          <p>You get <strong>3 free pages every month</strong> — they reset automatically, so come back any time.</p>
          <p>Three things people convert most:</p>
          <ul>
            <li><a href="${SITE}/tools/bank-statement-to-excel">Bank statements → Excel</a> (reconciliation, loan applications)</li>
            <li><a href="${SITE}/tools/pdf-to-excel">PDF invoices → Excel</a> (line items, totals, dates)</li>
            <li><a href="${SITE}/tools/pdf-to-gsheet">PDF → Google Sheets</a> (straight into your Drive)</li>
          </ul>
          <p>Scanned or photographed documents work too — the AI reads them like a human would.</p>
          <p><a href="${SITE}/tools/pdf-to-excel" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Convert your first document</a></p>
          `,
          userId
        ),
      };
    case "case_study":
      return {
        subject: "How bookkeepers turn a shoebox of statements into clean Excel",
        html: layout(
          `
          <h2 style="margin:0 0 12px;">The 2-hour job that now takes 4 minutes</h2>
          <p>The most common workflow we see from bookkeepers and accountants:</p>
          <ol>
            <li>Client sends 12 months of bank statements as PDFs (often scans).</li>
            <li>Each statement goes through <a href="${SITE}/tools/bank-statement-to-excel">Bank Statement → Excel</a>.</li>
            <li>The extracted table downloads with every transaction on its own row.</li>
            <li>Pro users hit <strong>“Export for QuickBooks”</strong> and import the 3-column CSV straight into QuickBooks or Xero.</li>
          </ol>
          <p>Typing one statement by hand takes ~20 minutes. The AI does it in ~30 seconds, including scanned documents.</p>
          <p><a href="${SITE}/tools/bank-statement-to-excel" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Try it with one statement</a></p>
          `,
          userId
        ),
      };
    case "founding_offer":
      return {
        subject: "Founding Member: lock in Pro at $3/month — forever",
        html: layout(
          `
          <h2 style="margin:0 0 12px;">You're early — that comes with a deal</h2>
          <p>We're opening <strong>50 Founding Member seats</strong>: Pro at <strong>$3/month, locked in for life</strong> (regular price $5/month).</p>
          <p>Pro gets you:</p>
          <ul>
            <li><strong>200 pages every month</strong></li>
            <li>QuickBooks-ready CSV export</li>
            <li>No watermark on exports</li>
            <li>Priority processing</li>
          </ul>
          <p>When the 50 seats are gone, they're gone. 7-day money-back guarantee, cancel anytime.</p>
          <p><a href="${SITE}/pricing" style="display:inline-block;background:#217346;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Claim a Founding seat — $3/mo</a></p>
          <p style="font-size:13px;color:#64748b;">Only need it for one project? There's also a <a href="${SITE}/pricing">$2 Week Pass</a> — unlimited for 7 days, one-time.</p>
          `,
          userId
        ),
      };
  }
}

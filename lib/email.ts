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
  text?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  // Replies go to the founder's real inbox. Note: the FROM address must be on
  // the Resend-verified domain (you cannot send as @gmail.com — DMARC).
  const replyTo = process.env.EMAIL_REPLY_TO ?? "kivora.lynx@gmail.com";
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
    body: JSON.stringify({
      from,
      to: params.to,
      reply_to: replyTo,
      subject: params.subject,
      html: params.html,
      ...(params.text && { text: params.text }),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[Email] Resend error:", res.status, body.slice(0, 300));
    return false;
  }
  return true;
}

// ── Drip templates ──────────────────────────────────────────────────────────
// Written as personal notes from the founder, not marketing blasts:
// plain paragraphs, no buttons/images, few links, real reply-to.
// That style is also what keeps them out of the spam folder.

const SITE = "https://www.invoicetodata.com";
const SIGNATURE = "Kivora\nCEO, InvoiceToData";

/** Convert the plain-text body to minimal HTML (paragraphs + clickable links). */
function textToHtml(text: string, userId: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" style="color:#2563eb;">$1</a>'
  );
  const paragraphs = linked
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 16px;white-space:pre-line;">${p}</p>`)
    .join("\n");
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;font-size:15px;line-height:1.6;">
    ${paragraphs}
    <p style="font-size:12px;color:#94a3b8;margin-top:32px;">
      Don't want these emails? <a href="${unsubscribeUrl(userId)}" style="color:#94a3b8;">Unsubscribe</a>.
    </p>
  </div>`;
}

export type DripType = "welcome" | "case_study" | "founding_offer";

export function dripEmail(
  type: DripType,
  userId: string
): { subject: string; html: string; text: string } {
  let subject: string;
  let body: string;

  switch (type) {
    case "welcome":
      subject = "thanks for signing up (a quick tip)";
      body = `Hi,

Kivora here — I'm the CEO of InvoiceToData. We're a small team, so yes, the CEO sends the welcome emails.

Thanks for signing up. Three things worth knowing:

1. You get 3 free pages every month, and they reset automatically — no card needed.
2. Scanned and photographed documents work, not just digital PDFs. Bank statements, invoices, receipts.
3. Most people start here: ${SITE}/tools/pdf-to-excel

One ask from me: if you convert a document and the result isn't right, just hit reply and tell me what type of document it was. I read every reply personally, and extraction bugs usually get fixed within days.

${SIGNATURE}`;
      break;

    case "case_study":
      subject = "the 2-hour job that takes 4 minutes now";
      body = `Hi,

Kivora from InvoiceToData again. Quick story about the most common way people use us.

A bookkeeper gets 12 months of bank statements from a client — usually scans, sometimes phone photos. The old way: retype every transaction into Excel, about 20 minutes per statement. Two hours gone on one client.

The new way: drop each statement into ${SITE}/tools/bank-statement-to-excel and every transaction comes out on its own row, in order, in about 30 seconds. Pro users then click "Export for QuickBooks" and import the CSV straight into QuickBooks or Xero.

If you've got a stack of statements sitting somewhere, try it with one. And if the output isn't right for your bank's format, reply and tell me which bank — I'll look at it myself.

${SIGNATURE}`;
      break;

    case "founding_offer":
      subject = "50 founding seats at $3/month (you're early)";
      body = `Hi,

Kivora here. You joined InvoiceToData early, and I want to say thanks in a way that's actually worth something.

We just opened 50 Founding Member seats: Pro at $3/month, locked in for as long as you stay subscribed. Regular price is $5/month, and once the 50 seats are taken, that's it.

Pro gives you 200 pages a month, QuickBooks-ready CSV export, no watermark on your files, and priority processing. There's a 7-day money-back guarantee and you can cancel anytime, so trying it is genuinely risk-free.

Claim a seat here: ${SITE}/pricing

Only need it for one project? There's also a $2 Week Pass on the same page — unlimited for 7 days, one-time payment, nothing to cancel.

Either way, thanks for being here early.

${SIGNATURE}`;
      break;
  }

  const text = `${body}\n\nUnsubscribe: ${unsubscribeUrl(userId)}`;
  return { subject, html: textToHtml(body, userId), text };
}

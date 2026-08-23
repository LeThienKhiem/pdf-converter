/**
 * Send the real drip email templates to a test inbox — deliverability check
 * without touching real users. Also reports how many real users the daily
 * drip would currently target.
 *
 * Usage:
 *   npx tsx --env-file=<path-to-env> scripts/send-test-drip.ts you@example.com
 */
import { createClient } from "@supabase/supabase-js";
import { dripEmail, sendEmail, type DripType } from "../lib/email";

const TYPES: DripType[] = ["welcome", "case_study", "founding_offer"];

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Usage: npx tsx scripts/send-test-drip.ts <recipient-email>");
    process.exit(1);
  }

  console.log(`FROM: ${process.env.EMAIL_FROM}`);
  console.log(`TO:   ${to}\n`);

  for (const type of TYPES) {
    // Dummy uid — the unsubscribe link is still HMAC-valid in shape.
    const { subject, html, text } = dripEmail(type, "00000000-0000-0000-0000-000000000000");
    const ok = await sendEmail({ to, subject, html, text });
    console.log(`${ok ? "✅" : "❌"} ${type}: "${subject}"`);
    await new Promise((r) => setTimeout(r, 800)); // stay under Resend rate limit
  }

  // How many real users would tonight's drip consider?
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    console.log(`\n(couldn't count recent signups: ${error.message})`);
    return;
  }
  const now = Date.now();
  const recent = data.users.filter(
    (u) =>
      u.email &&
      u.email_confirmed_at &&
      now - new Date(u.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
  );
  console.log(
    `\nReal drip targets right now: ${recent.length} confirmed users signed up in the last 30 days` +
      ` (of ${data.users.length} total on page 1).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await sb.from("extractions").select("user_id, pages_total, pages_extracted, created_at, tool").not("pages_total", "is", null);
  const rows = data ?? [];
  const gated = rows.filter((r) => Number(r.pages_extracted) < Number(r.pages_total));
  const guestGated = gated.filter((r) => !r.user_id).length;
  const userGated = gated.filter((r) => r.user_id).length;
  console.log(`10-page gate hits: ${gated.length} total | guests (CANNOT buy in place): ${guestGated} | signed-in (can buy): ${userGated}`);
  const sizes = gated.map((r) => Number(r.pages_total)).sort((a, b) => b - a);
  console.log("doc sizes that hit the gate:", JSON.stringify(sizes));
  console.log(`docs over 40 pages (would still truncate even if paid): ${sizes.filter(s => s > 40).length}`);
  const recent = gated.filter((r) => r.created_at >= "2026-09-25").length;
  console.log(`gate hits in the last 8 days: ${recent}`);
}
main().catch(console.error);

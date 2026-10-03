import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = data?.users ?? [];
  // The in-place Google sign-in at the download wall shipped 2026-09-12.
  const before = users.filter((u) => u.created_at < "2026-09-12");
  const after = users.filter((u) => u.created_at >= "2026-09-12");
  const google = (list: typeof users) => list.filter((u) => (u.app_metadata?.providers ?? []).includes("google")).length;
  console.log(`signups BEFORE in-place Google wall (to Sep 12): ${before.length} (google: ${google(before)})`);
  console.log(`signups AFTER  in-place Google wall (Sep 12 on): ${after.length} (google: ${google(after)})`);
  const { data: ext } = await sb.from("extractions").select("guest_key, created_at, status").eq("status", "success").gte("created_at", "2026-09-12");
  const guests = new Set((ext ?? []).filter((r) => r.guest_key).map((r) => r.guest_key)).size;
  console.log(`distinct guests who extracted since Sep 12: ${guests}`);
  console.log(`=> in-place sign-in conversion: ${after.length}/${guests} = ${guests ? Math.round(after.length/guests*100) : 0}%`);
}
main().catch(console.error);

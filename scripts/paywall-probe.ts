import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // 1. What does a new signup actually get?
  const { data: users } = await sb.from("users").select("id, credits, plan, pages_used, usage_period_start, created_at").order("created_at", { ascending: false });
  const u = users ?? [];
  const creditDist: Record<string, number> = {};
  for (const r of u) creditDist[String(r.credits)] = (creditDist[String(r.credits)] ?? 0) + 1;
  console.log("=== WHAT A SIGNUP GETS ===");
  console.log("credits distribution:", JSON.stringify(creditDist));
  console.log("pages_used distribution:", JSON.stringify(u.reduce((a: Record<string, number>, r) => { a[String(r.pages_used)] = (a[String(r.pages_used)] ?? 0) + 1; return a; }, {})));
  const totalFreeLeft = u.reduce((a, r) => a + Number(r.credits ?? 0) + Math.max(0, 3 - Number(r.pages_used ?? 0)), 0);
  console.log(`free extractions still unused across all ${u.length} users: ${totalFreeLeft}`);

  // 2. Failure breakdown with the new telemetry
  const { data: ext } = await sb.from("extractions").select("status, error_code, tool, pages_total, pages_extracted, duration_ms, model, user_id, created_at").order("created_at", { ascending: false }).limit(5000);
  const rows = ext ?? [];
  const fails = rows.filter((r) => r.status === "failed");
  const byCode: Record<string, number> = {};
  for (const f of fails) byCode[String(f.error_code ?? "null")] = (byCode[String(f.error_code ?? "null")] ?? 0) + 1;
  console.log("\n=== FAILURES ===");
  console.log(`${fails.length} of ${rows.length} (${Math.round(fails.length/rows.length*100)}%)`);
  console.log("by error_code:", JSON.stringify(byCode));
  const recentFails = fails.filter((f) => f.created_at >= "2026-09-20");
  console.log(`failures since Sep 20 (after truncation fix): ${recentFails.length}`);
  console.log("recent fail codes:", JSON.stringify(recentFails.reduce((a: Record<string, number>, f) => { a[String(f.error_code ?? "null")] = (a[String(f.error_code ?? "null")] ?? 0) + 1; return a; }, {})));

  // 3. Did anyone ever hit the 10-page gate (the upsell moment)?
  const gated = rows.filter((r) => r.pages_total != null && r.pages_extracted != null && Number(r.pages_extracted) < Number(r.pages_total));
  console.log("\n=== UPSELL MOMENTS ===");
  console.log(`extractions that hit the 10-page gate (saw "unlock all N pages"): ${gated.length}`);
  for (const g of gated.slice(0, 10)) console.log(`  ${String(g.created_at).slice(0,10)} ${g.pages_extracted}/${g.pages_total} pages, user=${g.user_id ? "signed-in" : "guest"}`);
  const multiPage = rows.filter((r) => Number(r.pages_total ?? 0) > 1);
  console.log(`extractions of multi-page docs: ${multiPage.length} | page counts:`, JSON.stringify(multiPage.slice(0,20).map(r=>r.pages_total)));

  // 4. How many signed-in users could even reach a wall?
  const perUser: Record<string, number> = {};
  for (const r of rows) if (r.user_id && r.status === "success") perUser[r.user_id] = (perUser[r.user_id] ?? 0) + 1;
  const maxUse = Math.max(0, ...Object.values(perUser));
  console.log(`\nmost extractions by a single signed-in user: ${maxUse} (wall is at 3 credits + 3 pages/mo = 6)`);
}
main().catch((e) => { console.error(e); process.exit(1); });

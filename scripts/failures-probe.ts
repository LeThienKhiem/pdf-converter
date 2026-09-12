import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  const { data } = await supabase
    .from("extractions")
    .select("tool, status, plan, ip, guest_key, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const byTool: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byIp: Record<string, number> = {};
  for (const r of rows) {
    byTool[r.tool] = (byTool[r.tool] ?? 0) + 1;
    byDay[String(r.created_at).slice(0, 10)] = (byDay[String(r.created_at).slice(0, 10)] ?? 0) + 1;
    byIp[r.ip ?? "?"] = (byIp[r.ip ?? "?"] ?? 0) + 1;
  }
  console.log("failed by tool:", JSON.stringify(byTool));
  console.log("failed by day:", JSON.stringify(byDay));
  const repeat = Object.entries(byIp).filter(([, c]) => c >= 2).sort((a,b)=>b[1]-a[1]);
  console.log("IPs with repeated failures:", JSON.stringify(repeat.slice(0, 8)));
  // Did the same IP eventually succeed?
  const failIps = new Set(rows.map((r) => r.ip));
  const { data: ok } = await supabase.from("extractions").select("ip").eq("status", "success");
  const okIps = new Set((ok ?? []).map((r) => r.ip));
  const failedThenGaveUp = [...failIps].filter((ip) => !okIps.has(ip)).length;
  console.log(`IPs that ONLY ever failed (never one success): ${failedThenGaveUp} of ${failIps.size}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

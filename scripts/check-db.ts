import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  for (const table of ["email_log", "extractions"]) {
    const { error } = await supabase.from(table).select("*").limit(1);
    console.log(table + ":", error ? "ERROR — " + error.message : "OK");
  }
  const { error: colErr } = await supabase.from("users").select("plan, email_opt_out").limit(1);
  console.log("users.plan/email_opt_out:", colErr ? "ERROR — " + colErr.message : "OK");
  const { error: insErr } = await supabase
    .from("email_log")
    .insert({ user_id: "86d2bc43-a98e-445f-95aa-a5812f9a0008", email_type: "_probe" });
  console.log("email_log insert:", insErr ? "ERROR — " + insErr.message : "OK (will clean up)");
  if (!insErr) {
    await supabase.from("email_log").delete().eq("email_type", "_probe");
  }
}
main();

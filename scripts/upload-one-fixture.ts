import fs from "fs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const src = process.argv[2]!, key = `e2e-fixtures/${process.argv[3]!}`;
  await sb.storage.from("uploads").upload(key, fs.readFileSync(src), { contentType: "application/pdf", upsert: true });
  const { data } = await sb.storage.from("uploads").createSignedUrl(key, 3600);
  console.log(data?.signedUrl);
}
main().catch((e) => { console.error(e); process.exit(1); });

/** Upload password-protected test statements and print signed URLs for E2E. */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const dir = process.argv[2]!;
  for (const name of ["statement-3p-locked.pdf", "statement-12p-locked.pdf"]) {
    const bytes = fs.readFileSync(path.join(dir, name));
    const key = `e2e-fixtures/${name}`;
    await sb.storage.from("uploads").upload(key, bytes, { contentType: "application/pdf", upsert: true });
    const { data } = await sb.storage.from("uploads").createSignedUrl(key, 3600);
    console.log(name, "->", data?.signedUrl);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

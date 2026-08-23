import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const email = "kivora.lynx+test@gmail.com";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) {
    console.log("createUser:", error.message);
    return;
  }
  console.log("Created test user:", data.user?.id, email);
}
main();

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";

/** GET: return current user's credit balance. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabase();
  const { data, error } = await admin
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (error || data == null) {
    return NextResponse.json(
      { error: error?.message ?? "User not found" },
      { status: 404 }
    );
  }

  const credits = (data as { credits: number }).credits ?? 0;
  return NextResponse.json({ credits });
}

/** POST: deduct 1 credit for the current user. Returns new balance or 402 if out of credits. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabase();
  const { data: row, error: fetchError } = await admin
    .from("users")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (fetchError || row == null) {
    return NextResponse.json(
      { error: fetchError?.message ?? "User not found" },
      { status: 404 }
    );
  }

  const current = (row as { credits: number }).credits ?? 0;
  if (current <= 0) {
    return NextResponse.json(
      { error: "Out of credits", credits: 0 },
      { status: 402 }
    );
  }

  const newCredits = current - 1;
  const { error: updateError } = await admin
    .from("users")
    .update({ credits: newCredits })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ credits: newCredits });
}

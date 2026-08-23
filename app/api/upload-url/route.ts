import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";
import { getPaidStatus } from "@/lib/entitlements";

/**
 * Signed upload URL for large files (5–25MB), which exceed the serverless
 * request-body limit. Paid users only — this IS the large-file paywall.
 * The client uploads directly to Supabase Storage, then calls /api/extract
 * with { storagePath }; extract downloads, processes, and deletes the file.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { isPaid } = await getPaidStatus(user.id);
  if (!isPaid) {
    return NextResponse.json(
      {
        error: "Files over 5MB need a paid plan.",
        reason: "file_too_large",
      },
      { status: 402 }
    );
  }

  let fileName = "document.pdf";
  try {
    const body = (await request.json()) as { fileName?: string };
    if (typeof body.fileName === "string" && body.fileName) {
      fileName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    }
  } catch {
    // no body — use default name
  }

  const path = `${user.id}/${Date.now()}-${fileName}`;
  const admin = getSupabase();
  const { data, error } = await admin.storage
    .from("uploads")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[UploadUrl] Failed to sign:", error?.message);
    return NextResponse.json(
      { error: "Could not create upload URL. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}

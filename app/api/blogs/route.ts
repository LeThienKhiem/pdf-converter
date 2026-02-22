import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase: set these in .env.local
// NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
// SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (or use anon key for client-side rules)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type BlogPayload = {
  title: string;
  slug: string;
  meta_description: string;
  keywords: string;
  content: string;
};

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server missing Supabase configuration (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, slug, meta_description, keywords, content } = body as Partial<BlogPayload>;

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json(
        { error: "Title and slug are required." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Table name: adjust to match your Supabase table (e.g. "blogs" or "posts").
    // Columns: id (uuid, default gen_random_uuid()), title, slug, meta_description, keywords, content, created_at, updated_at, etc.
    const { data, error } = await supabase
      .from("blogs")
      .insert({
        title: title.trim(),
        slug: slug.trim(),
        meta_description: (meta_description ?? "").trim(),
        keywords: (keywords ?? "").trim(),
        content: (content ?? "").trim(),
        // Add if your table has them: created_at, updated_at, published_at, author_id, etc.
      })
      .select()
      .single();

    if (error) {
      console.error("[API blogs] Supabase error:", error);
      return NextResponse.json(
        { error: error.message ?? "Database error." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[API blogs] Error:", err);
    const message = err instanceof Error ? err.message : "An error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

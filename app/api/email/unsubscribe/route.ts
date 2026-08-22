import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/email";

/** One-click unsubscribe from drip emails (HMAC-signed link, no login needed). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const uid = url.searchParams.get("uid") ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!uid || !verifyUnsubscribeToken(uid, token)) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }

  const admin = getSupabase();
  const { error } = await admin.from("users").update({ email_opt_out: true }).eq("id", uid);
  if (error) {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#0f172a;">
<div style="text-align:center;padding:24px;">
<h1 style="font-size:20px;">You're unsubscribed ✅</h1>
<p style="color:#64748b;">You won't receive onboarding emails from InvoiceToData anymore.</p>
<a href="https://www.invoicetodata.com" style="color:#2563eb;">Back to InvoiceToData</a>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

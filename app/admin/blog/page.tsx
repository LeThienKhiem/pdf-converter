import type { Metadata } from "next";
import { checkAdmin } from "@/lib/adminAuth";
import AdminGate from "../AdminGate";
import BlogAdminClient from "./BlogAdminClient";

export const metadata: Metadata = {
  title: "Blog Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Previously "protected" by a hardcoded client-side access key ("admin"),
 * which anyone could read in the bundle and use to publish posts. Now behind
 * the same server-side Google allowlist as the rest of /admin.
 */
export default async function AdminBlogPage() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate reason={check.reason} email={check.email} />;
  return <BlogAdminClient />;
}

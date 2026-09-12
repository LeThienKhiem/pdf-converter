import type { Metadata } from "next";
import { checkAdmin } from "@/lib/adminAuth";
import AdminGate from "./AdminGate";
import AdminDashboard from "./AdminDashboard";

export const metadata: Metadata = {
  title: "Performance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate reason={check.reason} email={check.email} />;
  return <AdminDashboard email={check.email} />;
}

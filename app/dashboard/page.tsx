import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Coins, CreditCard, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Dashboard | InvoiceToData",
  description: "View your credit balance and billing history.",
};

type TransactionRow = {
  created_at: string;
  amount_usd: number | null;
  credits_added: number | null;
  status: string | null;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [userRow, transactionsResult] = await Promise.all([
    supabase.from("users").select("credits").eq("id", user.id).single(),
    supabase
      .from("transactions")
      .select("created_at, amount_usd, credits_added, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const credits = userRow?.data?.credits ?? 0;
  const transactions: TransactionRow[] = transactionsResult.data ?? [];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        <Link
          href="/"
          className="inline-block text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to Home
        </Link>

        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Welcome back, {user.email ?? "User"}
          </h1>
        </header>

        {/* Credit Balance Card */}
        <section
          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm sm:p-8"
          aria-labelledby="credits-heading"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#217346]/10 text-[#217346]">
                <Coins className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 id="credits-heading" className="text-sm font-medium text-slate-500">
                  Available credits
                </h2>
                <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  {credits}
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#217346] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-[#1d603d] hover:shadow-lg sm:w-auto"
            >
              Buy More Credits
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Billing History */}
        <section aria-labelledby="billing-heading">
          <h2 id="billing-heading" className="text-xl font-semibold text-slate-900 mb-4">
            Billing history
          </h2>

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
              <p className="mt-3 text-slate-600 font-medium">
                You haven&apos;t made any purchases yet.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                When you buy credit packs, they&apos;ll appear here.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#217346] hover:text-[#1d603d]"
              >
                View pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 bg-white">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6"
                      >
                        Amount paid
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6"
                      >
                        Credits added
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transactions.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 sm:px-6">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900 sm:px-6">
                          {formatAmount(row.amount_usd)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 sm:px-6">
                          {row.credits_added != null ? `+${row.credits_added}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              row.status === "completed" || row.status === "succeeded"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.status === "pending"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.status ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {transactions.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-slate-900">
                        {formatAmount(row.amount_usd)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.status === "completed" || row.status === "succeeded"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.status ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(row.created_at)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Credits added: {row.credits_added != null ? `+${row.credits_added}` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

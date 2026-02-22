import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import PdfToGsheetTool from "@/components/PdfToGsheetTool";
import AdBanner from "@/components/AdBanner";

type Props = { params: Promise<{ slug: string }> };

type LandingPage = {
  slug: string;
  h1_title: string;
  meta_description: string | null;
  pain_point: string | null;
  industry: string | null;
};

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (!hasSupabaseConfig) return [];
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from("landing_pages").select("slug");
    if (!data || !Array.isArray(data)) return [];
    return (data as { slug: string }[]).map((row) => ({ slug: row.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!hasSupabaseConfig) return { title: "Tools" };
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("landing_pages")
      .select("h1_title, meta_description")
      .eq("slug", slug)
      .single();
    if (!data) return { title: "Tools" };
    const row = data as { h1_title: string; meta_description: string | null };
    return {
      title: row.h1_title,
      description: row.meta_description ?? undefined,
    };
  } catch {
    return { title: "Tools" };
  }
}

export default async function ToolLandingPage({ params }: Props) {
  const { slug } = await params;

  if (!hasSupabaseConfig) notFound();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("slug, h1_title, meta_description, pain_point, industry")
    .eq("slug", slug)
    .single();

  if (error || !data) notFound();

  const page = data as LandingPage;
  const industry = page.industry?.trim() || "your industry";
  const industryLower = industry.toLowerCase();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <header className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {page.h1_title}
          </h1>
          {page.pain_point && (
            <p className="mt-4 text-lg text-slate-600 sm:text-xl">
              {page.pain_point}
            </p>
          )}
        </header>

        {/* Tool */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <PdfToGsheetTool showExcelLink={true} />
        </div>

        {/* SEO content */}
        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-10 sm:px-8 sm:py-12" aria-labelledby="benefits-heading">
          <h2 id="benefits-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Why automate this workflow for {industry}
          </h2>
          <p className="mt-6 text-slate-600">
            Automating PDF-to-spreadsheet extraction saves time and reduces errors for {industryLower}. Instead of manual data entry, paste, or re-typing from invoices and reports, you get structured data in Google Sheets in seconds. Teams can collaborate on the same sheet, and the AI preserves table layout and formatting so your numbers stay accurate. Try the tool above to turn your next PDF into a Google Sheet with one click.
          </p>
        </section>

        <div className="my-12 flex min-h-[120px] justify-center">
          <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID ?? "0000000001"} />
        </div>
      </main>
    </div>
  );
}

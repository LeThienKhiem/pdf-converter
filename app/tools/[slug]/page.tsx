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

        {/* Ad: above first content section */}
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <div className="min-h-[100px] flex justify-center items-center">
            <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID ?? "0000000001"} />
          </div>
        </div>

        {/* Industry-specific challenges */}
        <section className="prose prose-slate mt-16 max-w-4xl rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-8 sm:py-12" aria-labelledby="industry-challenges-heading">
          <h2 id="industry-challenges-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Why {industry} Professionals Need Automated PDF Extraction
          </h2>
          <p className="mt-6 text-slate-600">
            {industry} teams often spend hours on manual data entry: re-typing figures from invoices, copying tables from reports into spreadsheets, or reconciling numbers across documents. This not only slows down workflows but also increases the risk of errors and audit findings. Automating PDF extraction removes the bottleneck—you upload a document, and the AI returns structured data in Google Sheets in seconds, so your team can focus on analysis and decisions instead of data entry.
          </p>
          <p className="mt-4 text-slate-600">
            Auditing and compliance in {industryLower} demand accuracy and traceability. When data is hand-keyed, mistakes can slip through and spread across downstream reports. An AI-powered pipeline preserves the original layout and values, reducing transcription errors and giving you a clear path from source PDF to spreadsheet. For {industryLower} professionals who need to move quickly without sacrificing accuracy, automated extraction is becoming essential.
          </p>
        </section>

        {/* Step-by-step guide */}
        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/60 px-6 py-10 sm:px-8 sm:py-12" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            How to Convert {industry} PDFs to Excel in 3 Steps
          </h2>
          <ol className="mt-8 list-decimal space-y-6 pl-6 text-slate-600 sm:pl-8">
            <li>
              <strong className="text-slate-900">Upload your {industryLower} PDF.</strong> Use the tool above to drag and drop your file or click to browse. We accept invoices, statements, reports, and scanned documents. The file is processed in memory and is not stored on our servers.
            </li>
            <li>
              <strong className="text-slate-900">Let the AI extract and structure the data.</strong> Our system analyzes the layout of your document and maps rows, columns, and headers into a table. Tables, lists, and multi-section layouts are preserved so the output matches your original.
            </li>
            <li>
              <strong className="text-slate-900">Copy the result to Google Sheets.</strong> When extraction is complete, you get a link to a Google Sheet. Use &quot;Make a copy&quot; to add it to your Drive and start editing, sharing, or importing into your {industryLower} workflows immediately.
            </li>
          </ol>
        </section>

        {/* Dynamic FAQ – 4 industry-tailored */}
        <section className="mt-16 rounded-2xl border border-slate-200 bg-white px-6 py-10 sm:px-8 sm:py-12" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Frequently Asked Questions
          </h2>
          <dl className="mt-8 space-y-8">
            <div>
              <dt className="text-base font-semibold text-slate-900">Is this compliant for {industry} data?</dt>
              <dd className="mt-2 text-slate-600">
                We do not store your documents or extracted data. Files are processed in memory and deleted immediately after extraction, which supports compliance with data minimization and privacy expectations common in {industryLower} workflows. For specific regulatory requirements, we recommend reviewing our privacy policy and your internal policies.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">Is my financial and {industry} data secure?</dt>
              <dd className="mt-2 text-slate-600">
                Yes. We do not store your documents. Files are processed securely and deleted immediately after extraction. Your data is not retained on our servers.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">Can the AI handle complex or scanned {industryLower} PDFs?</dt>
              <dd className="mt-2 text-slate-600">
                Yes. Our advanced OCR and AI models can read both native digital PDFs and scanned images with high accuracy, so invoices, reports, and forms typical in {industryLower} are supported.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-slate-900">Will the Excel/Sheets export keep my original formatting?</dt>
              <dd className="mt-2 text-slate-600">
                Yes. The system is designed to maintain table structures, rows, and columns exactly as they appear in your original document, so you can rely on the output for analysis and reporting in {industryLower}.
              </dd>
            </div>
          </dl>
        </section>

        {/* Ad: below FAQ */}
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <div className="min-h-[100px] flex justify-center items-center">
            <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT ?? "0000000003"} />
          </div>
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

        <div className="my-12 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">Advertisement</p>
          <div className="min-h-[120px] flex justify-center items-center">
            <AdBanner dataAdSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_MID ?? "0000000001"} />
          </div>
        </div>
      </main>
    </div>
  );
}

import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Vercel Cron Job — runs every Monday 9:00 AM UTC (4:00 PM VN)
 * Sends a weekly Telegram message with ONE specific backlink task
 * that takes 15-30 minutes. Includes pre-written content ready to copy-paste.
 *
 * This is the 20% manual work that makes the biggest SEO difference.
 */

const SITE_URL = "https://invoicetodata.com";

// Backlink tasks — rotates weekly, each task is specific and actionable
const BACKLINK_TASKS = [
  {
    week: 1,
    title: "🚀 Product Hunt Launch",
    platform: "Product Hunt",
    url: "https://www.producthunt.com/posts/new",
    timeEstimate: "20 min",
    instructions: `1. Vào producthunt.com → đăng nhập/tạo account
2. Click "Post" → điền thông tin:

<b>Tagline:</b>
Convert invoices to structured Excel/Sheets data in seconds using AI OCR

<b>Description:</b>
InvoiceToData uses AI-powered OCR to extract data from PDF invoices and convert them into structured Excel or Google Sheets format. Upload any invoice — scanned, digital, or photographed — and get clean, organized data instantly.

Key features:
• AI OCR powered by Gemini
• Supports PDF, scanned documents, photos
• Export to Excel or Google Sheets
• No data stored — processed in memory only
• Free to use

<b>Topics:</b> Artificial Intelligence, SaaS, Productivity, Accounting

<b>Link:</b> ${SITE_URL}

3. Upload 2-3 screenshots của tool
4. Submit và share link với bạn bè để upvote`,
  },
  {
    week: 2,
    title: "📋 AlternativeTo Listing",
    platform: "AlternativeTo",
    url: "https://alternativeto.net/manage/new/",
    timeEstimate: "15 min",
    instructions: `1. Vào alternativeto.net → đăng nhập
2. Click "Add Application" → điền:

<b>Name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>Description:</b>
Free AI-powered tool that converts PDF invoices into structured Excel and Google Sheets data. Uses advanced OCR to extract tables, line items, and financial data from any invoice format.

<b>Tags:</b> Invoice, OCR, PDF, Excel, Data Extraction, AI
<b>Alternatives to:</b> ABBYY FineReader, Nanonets, Klippa, Rossum
<b>Platforms:</b> Web
<b>License:</b> Free

3. Submit listing`,
  },
  {
    week: 3,
    title: "🤖 There's An AI For That",
    platform: "There's An AI For That",
    url: "https://theresanaiforthat.com/submit/",
    timeEstimate: "10 min",
    instructions: `1. Vào theresanaiforthat.com/submit
2. Điền form:

<b>Tool name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>One-liner:</b> AI-powered invoice OCR that converts PDFs to Excel/Google Sheets instantly
<b>Description:</b>
InvoiceToData uses Gemini AI to extract structured data from PDF invoices. Upload any invoice and get clean, organized data in Excel or Google Sheets format. No data is stored — everything is processed in memory for maximum privacy.

<b>Category:</b> Productivity, Finance, Document Processing
<b>Pricing:</b> Free

3. Submit`,
  },
  {
    week: 4,
    title: "💼 SaaSHub Listing",
    platform: "SaaSHub",
    url: "https://www.saashub.com/submit",
    timeEstimate: "10 min",
    instructions: `1. Vào saashub.com → đăng nhập
2. Click "Submit a Product":

<b>Name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>Tagline:</b> AI Invoice OCR — Convert PDF invoices to Excel & Google Sheets
<b>Description:</b>
Free AI-powered SaaS tool that uses OCR to extract data from PDF invoices and convert them into structured Excel or Google Sheets. Powered by Gemini AI. No data retention — files processed in memory only.

<b>Category:</b> Invoice Processing, OCR, Data Extraction
<b>Alternatives to:</b> Nanonets, ABBYY, Klippa, Rossum

3. Submit`,
  },
  {
    week: 5,
    title: "🛠️ ToolPilot AI Listing",
    platform: "ToolPilot.ai",
    url: "https://www.toolpilot.ai/submit",
    timeEstimate: "10 min",
    instructions: `1. Vào toolpilot.ai → Submit Tool
2. Điền form:

<b>Name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>Description:</b>
Free AI-powered invoice processing tool. Upload PDF invoices and get structured data in Excel or Google Sheets. Uses Gemini AI OCR for accurate data extraction from any invoice format — digital, scanned, or photographed.

<b>Category:</b> Productivity, Finance
<b>Pricing:</b> Free

3. Submit`,
  },
  {
    week: 6,
    title: "💻 GitHub Repository",
    platform: "GitHub",
    url: "https://github.com/new",
    timeEstimate: "20 min",
    instructions: `1. Tạo repo public mới trên GitHub
2. Tên repo: <code>invoice-ocr-guide</code> hoặc <code>pdf-to-excel-tools</code>

3. Tạo README.md với nội dung:

<code># Best Invoice OCR & PDF to Excel Tools (2026)

A curated list of tools for extracting data from PDF invoices.

## Top Tools

### InvoiceToData (⭐ Recommended)
- **URL:** ${SITE_URL}
- **Features:** AI OCR, PDF to Excel, PDF to Google Sheets
- **Pricing:** Free
- **Privacy:** No data stored

### Others
- ABBYY FineReader
- Nanonets
- Tabula (open source)

## How Invoice OCR Works
Invoice OCR uses AI to scan PDF documents and extract structured data like vendor names, amounts, dates, and line items into spreadsheet format.

## Contributing
PRs welcome! Add your favorite invoice processing tool.
</code>

4. Commit và publish`,
  },
  {
    week: 7,
    title: "📝 dev.to Article (Manual)",
    platform: "dev.to",
    url: "https://dev.to/new",
    timeEstimate: "15 min",
    instructions: `1. Vào dev.to → Write a Post
2. Viết bài ngắn (hoặc copy-paste nội dung dưới):

<b>Title:</b> How I Built an AI Invoice Parser That Converts PDFs to Excel

<code>
## The Problem
Manual invoice data entry is slow and error-prone. I needed a way to automatically extract data from PDF invoices into spreadsheets.

## The Solution
I built [InvoiceToData](${SITE_URL}) — a free tool that uses Gemini AI to OCR invoices and output structured data to Excel or Google Sheets.

## How It Works
1. Upload a PDF invoice
2. AI analyzes the document layout
3. Data is extracted into rows and columns
4. Download as Excel or copy to Google Sheets

## Tech Stack
- Next.js frontend
- Gemini AI for OCR
- Vercel deployment
- No data retention — processed in memory

Try it free: [invoicetodata.com](${SITE_URL})
</code>

<b>Tags:</b> ai, webdev, saas, productivity

3. Publish`,
  },
  {
    week: 8,
    title: "🔍 Hacker News - Show HN",
    platform: "Hacker News",
    url: "https://news.ycombinator.com/submitlink",
    timeEstimate: "10 min",
    instructions: `1. Vào news.ycombinator.com → đăng nhập
2. Submit → điền:

<b>Title:</b> Show HN: Free AI tool to convert PDF invoices to Excel/Google Sheets
<b>URL:</b> ${SITE_URL}

3. Sau khi post, viết comment đầu tiên:

<code>Hi HN! I built this because I was tired of manually copying data from PDF invoices into spreadsheets.

InvoiceToData uses Gemini AI to OCR any PDF invoice and extract structured data into Excel or Google Sheets. It handles scanned documents, digital PDFs, and even photographed invoices.

Key decisions:
- No data retention (processed in memory only)
- Free to use
- Built with Next.js + Vercel

Would love feedback on accuracy and UX. Happy to answer questions!
</code>

4. Trả lời comments nếu có (quan trọng cho engagement)`,
  },
  {
    week: 9,
    title: "🌐 SaaSWorthy Listing",
    platform: "SaaSWorthy",
    url: "https://www.saasworthy.com/submit-product",
    timeEstimate: "10 min",
    instructions: `1. Vào saasworthy.com → Submit Product
2. Điền:

<b>Name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>Category:</b> Invoice Management, OCR, Document Management
<b>Description:</b>
AI-powered invoice OCR tool that extracts data from PDF invoices and converts to Excel or Google Sheets. Free, no data stored, powered by Gemini AI.

3. Submit`,
  },
  {
    week: 10,
    title: "📊 G2 Product Listing",
    platform: "G2",
    url: "https://www.g2.com/products/new",
    timeEstimate: "25 min",
    instructions: `1. Vào g2.com → List Your Product (Free)
2. Điền đầy đủ profile:

<b>Product Name:</b> InvoiceToData
<b>URL:</b> ${SITE_URL}
<b>Category:</b> Invoice Management Software, OCR Software
<b>Description:</b>
InvoiceToData is a free AI-powered tool that converts PDF invoices into structured Excel and Google Sheets data using advanced OCR technology. Powered by Gemini AI, it handles scanned, digital, and photographed invoices with high accuracy. No data is retained — all processing happens in memory.

<b>Key Features:</b>
• AI-powered OCR extraction
• PDF to Excel conversion
• PDF to Google Sheets
• Scanned document support
• Zero data retention

3. Upload logo + screenshots
4. Submit cho review (G2 sẽ verify trong 1-2 tuần)

💡 G2 là backlink mạnh nhất (DA 90+). Sau khi listing được approve, nhờ 2-3 người dùng viết review.`,
  },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // TURBO MODE: Send 2 tasks per week instead of 1
    const campaignStart = new Date("2026-03-01").getTime();
    const now = Date.now();
    const weekNumber = Math.floor((now - campaignStart) / (7 * 24 * 60 * 60 * 1000));

    // Send 2 tasks per run (accelerated backlink building)
    const taskIndex1 = (weekNumber * 2) % BACKLINK_TASKS.length;
    const taskIndex2 = (weekNumber * 2 + 1) % BACKLINK_TASKS.length;
    const tasks = [BACKLINK_TASKS[taskIndex1], BACKLINK_TASKS[taskIndex2]];

    for (const task of tasks) {
      const msg = `🔗 <b>Backlink Task — DO THIS NOW</b>

${task.title}
⏱️ Thời gian: ~${task.timeEstimate}
🌐 Platform: <a href="${task.url}">${task.platform}</a>

<b>Hướng dẫn chi tiết:</b>
${task.instructions}

💰 <i>Payment gateway is LIVE — every backlink = more organic traffic = more revenue!</i>`;

      await sendTelegramMessage(msg);
      // Small delay between messages to avoid Telegram rate limit
      await new Promise((r) => setTimeout(r, 1000));
    }

    return NextResponse.json({
      success: true,
      week: weekNumber + 1,
      tasks: tasks.map((t) => t.title),
      platform: task.platform,
    });
  } catch (err) {
    console.error("[Backlink Tasks Cron] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    await sendTelegramMessage(`❌ <b>Backlink Tasks Cron Failed</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

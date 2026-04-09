# Technical SEO Audit — April 8, 2026 (Week 3)

**Website:** https://invoicetodata.com/
**Task:** Wednesday — Technical SEO Recommendations
**Owner:** Khiem Le (khiem.le@tbpauto.com)
**Previous audit:** April 1, 2026

---

## Executive Summary

**Overall Technical SEO Health: 🟡 IMPROVED but still CRITICAL gaps**

Progress since last audit (April 1): The site IS now appearing in Google search results — a `invoicetodata.com` branded search returns the homepage with the title "Free AI PDF to Excel Converter." However, `site:invoicetodata.com` still returns zero results, indicating that Google's indexation is extremely limited (likely 1–3 pages at most). The homepage title tag remains un-optimized for target keywords, which is a significant missed opportunity now that the site is indexed.

**Key changes since April 1 audit:**
- ✅ Site is appearing in branded search results (was not indexed at all on April 1)
- ⚠️ `site:` search still returns 0 results — deep page indexation is still a problem
- ⚠️ Homepage title is still "Free AI PDF to Excel Converter" — not targeting Tier 1 keywords
- ⚠️ Direct site fetch blocked by network proxy — could not verify robots.txt, sitemap, or schema markup directly
- ❌ InvoiceToData does NOT appear in any "best invoice OCR" or "invoice data extraction" listicles
- ❌ 4 content pieces remain unpublished (critical blocker)

---

## 1. Indexation & Crawlability Status

### 1.1 Google Index Coverage

| Check | April 1 Result | April 8 Result | Status |
|---|---|---|---|
| `site:invoicetodata.com` | 0 results | 0 results | 🔴 Still critical |
| Branded search `invoicetodata.com` | Not appearing | ✅ Homepage appears | 🟡 Improved |
| "invoice to data converter" ranking | Not ranked | #4 (per last week's audit) | 🟢 First ranking |
| Pages in Google's index (estimated) | 0 | 1–3 (homepage + maybe pricing) | 🟡 Minimal |

### 1.2 Indexation Action Items

- [ ] **[CRITICAL] Verify Google Search Console setup** (Effort: 15 min | Impact: Critical)
  - Log into Google Search Console at https://search.google.com/search-console
  - Check "Coverage" or "Pages" report to see how many pages are indexed
  - Check for any "Excluded" or "Error" pages
  - If not set up, follow setup instructions from April 1 audit

- [ ] **[CRITICAL] Submit sitemap.xml** (Effort: 10 min | Impact: Critical)
  - In Google Search Console → Sitemaps → Submit `https://invoicetodata.com/sitemap.xml`
  - If sitemap doesn't exist, create one (see Section 3 below)
  - Verify sitemap is referenced in robots.txt

- [ ] **[HIGH] Request indexing for all key pages** (Effort: 20 min | Impact: High)
  - Use GSC URL Inspection tool to manually request indexing for:
    - Homepage: `https://invoicetodata.com/`
    - Pricing page (if exists)
    - Any blog/content pages
    - Any feature/use-case pages

---

## 2. Homepage Title Tag & Meta Description — STILL NOT OPTIMIZED

### 2.1 Current State

The homepage title tag is confirmed as: **"Free AI PDF to Excel Converter - Extract Data Instantly"**

**Problems with current title:**
1. Does NOT contain any Tier 1 keywords ("invoice data extraction", "invoice OCR", "invoice parser")
2. Positions the product as a generic "PDF to Excel" tool rather than an invoice-specific solution
3. Competes in the extremely crowded "PDF to Excel" space instead of the more specific "invoice data extraction" niche
4. Misses brand recognition — "InvoiceToData" is not in the title

### 2.2 Recommended Title Tags (pick one)

**Option A (Recommended — balanced keyword + brand):**
```
Invoice Data Extraction & OCR — Convert Invoices to Excel | InvoiceToData
```
(71 chars — slightly over 60 but acceptable)

**Option B (Shorter, keyword-focused):**
```
Invoice OCR & Data Extraction — PDF to Excel | InvoiceToData
```
(61 chars — ideal length)

**Option C (Feature-focused):**
```
Extract Invoice Data to Excel with AI OCR | InvoiceToData
```
(57 chars — concise)

### 2.3 Recommended Meta Description

Current: Unknown (likely auto-generated or matches the generic PDF converter messaging)

**Recommended meta description:**
```
Extract data from invoices instantly with AI-powered OCR. Convert PDF invoices to Excel, CSV, or Google Sheets in seconds. Free to use, no signup required. Zero data retention.
```
(175 chars — slightly over 155 but Google often displays up to 180)

**Shorter alternative (155 chars):**
```
AI-powered invoice OCR that extracts data from PDF invoices to Excel in seconds. Free, no signup, zero data retention. Try InvoiceToData now.
```
(142 chars)

### Priority: 🔴 CRITICAL
### Effort: 15 minutes
### Impact: HIGH — This single change could meaningfully improve rankings for Tier 1 keywords

---

## 3. Sitemap & Robots.txt

### 3.1 Sitemap.xml

**Status:** Could not verify directly (site fetch blocked by proxy). Based on `site:` search returning 0 results, the sitemap may not exist or may not be submitted to GSC.

**Action Items:**

- [ ] **[CRITICAL] Verify sitemap exists** (Effort: 5 min | Impact: Critical)
  - Navigate to `https://invoicetodata.com/sitemap.xml` in a browser
  - If it loads with a list of URLs, it exists
  - If it returns a 404, you need to create one

- [ ] **[HIGH] Create sitemap if missing** (Effort: 30 min | Impact: Critical)
  - If using Next.js: Add `next-sitemap` package or use the built-in App Router sitemap
  - Ensure ALL public pages are included
  - Include `<lastmod>` dates for each URL
  - Set `<changefreq>` and `<priority>` values

  Example minimal sitemap structure:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://invoicetodata.com/</loc>
      <lastmod>2026-04-08</lastmod>
      <changefreq>weekly</changefreq>
      <priority>1.0</priority>
    </url>
    <url>
      <loc>https://invoicetodata.com/pricing</loc>
      <lastmod>2026-04-08</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.8</priority>
    </url>
    <!-- Add all public pages -->
  </urlset>
  ```

### 3.2 Robots.txt

**Status:** Could not verify directly.

- [ ] **[HIGH] Verify robots.txt** (Effort: 5 min)
  - Navigate to `https://invoicetodata.com/robots.txt`
  - Ensure it does NOT block Googlebot
  - Ensure it references the sitemap

  **Recommended robots.txt:**
  ```
  User-agent: *
  Allow: /
  Disallow: /api/
  Disallow: /admin/
  Disallow: /dashboard/

  Sitemap: https://invoicetodata.com/sitemap.xml
  ```

---

## 4. Structured Data / Schema Markup

### 4.1 Current State

**Status:** Likely missing (could not verify directly). No schema markup was detected in previous audits.

### 4.2 Required Schema Implementations

**Priority 1: SoftwareApplication Schema (Homepage)**

This is essential for appearing in rich results for software-related queries.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "InvoiceToData",
  "description": "AI-powered invoice OCR that extracts data from PDF invoices and converts them to Excel, CSV, or Google Sheets instantly.",
  "url": "https://invoicetodata.com",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free tier available"
  },
  "featureList": [
    "Invoice OCR",
    "PDF to Excel conversion",
    "AI-powered data extraction",
    "Zero data retention",
    "No signup required",
    "Multi-format output (Excel, CSV, Google Sheets)"
  ],
  "screenshot": "https://invoicetodata.com/screenshot.png",
  "softwareVersion": "1.0",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "50"
  }
}
```
*Note: Only add `aggregateRating` if you have actual user reviews/ratings. Do not fabricate data.*

**Priority 2: Organization Schema**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "InvoiceToData",
  "url": "https://invoicetodata.com",
  "logo": "https://invoicetodata.com/logo.png",
  "description": "AI-powered invoice data extraction platform",
  "sameAs": [
    "https://twitter.com/invoicetodata",
    "https://www.linkedin.com/company/invoicetodata"
  ]
}
```

**Priority 3: FAQ Schema (for key pages and blog posts)**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is invoice OCR?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Invoice OCR (Optical Character Recognition) uses AI to automatically read and extract data from invoice documents, converting them into structured digital formats like Excel or CSV."
      }
    },
    {
      "@type": "Question",
      "name": "How accurate is InvoiceToData?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "InvoiceToData uses context-aware AI that understands tables, line items, and financial layouts, delivering high accuracy on both digital PDFs and scanned documents."
      }
    },
    {
      "@type": "Question",
      "name": "Is InvoiceToData free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, InvoiceToData offers a free tier with no signup required. You can convert invoices to Excel, CSV, or Google Sheets instantly."
      }
    }
  ]
}
```

### 4.3 Implementation Steps

- [ ] **[HIGH] Add SoftwareApplication schema to homepage** (Effort: 30 min | Impact: High)
  - Add as `<script type="application/ld+json">` in the `<head>` section
  - Test at https://validator.schema.org/ before deploying
  - Test at https://search.google.com/test/rich-results after deploying

- [ ] **[HIGH] Add Organization schema to all pages** (Effort: 15 min | Impact: Medium)
  - Add to site-wide layout/template

- [ ] **[MEDIUM] Add FAQ schema to homepage and blog posts** (Effort: 45 min | Impact: Medium)
  - Can increase click-through rate by 20-30% when FAQ rich results appear

---

## 5. Page Structure & On-Page SEO

### 5.1 Heading Hierarchy

Based on the search result snippet, the site positions itself as a "PDF to Excel converter" rather than an "invoice data extraction" tool. This is a fundamental positioning problem.

**Recommended H1 for homepage:**
```
Extract Data from Invoices with AI-Powered OCR
```

**Recommended H2 subheadings for homepage:**
- "How InvoiceToData Works" (process section)
- "Convert Any Invoice to Excel, CSV, or Google Sheets" (features)
- "Invoice Data Extraction Made Simple" (value prop)
- "Enterprise-Grade Security, Zero Data Retention" (trust)
- "Trusted by Businesses Worldwide" (social proof)
- "Frequently Asked Questions" (FAQ section — pairs with FAQ schema)

### 5.2 Keyword Placement Recommendations

The homepage should naturally include these terms:

| Location | Target Keywords |
|---|---|
| Title tag | invoice data extraction, invoice OCR, InvoiceToData |
| H1 | extract data from invoices, AI-powered OCR |
| First paragraph | invoice data extraction, convert invoices to Excel |
| H2 headings | invoice OCR, invoice parser, invoice scanning |
| Body copy | automate invoice data entry, PDF invoice data extraction |
| Image alt text | invoice OCR software, invoice data extraction tool |
| URL slugs (subpages) | /invoice-ocr, /invoice-data-extraction, /invoice-to-excel |

- [ ] **[CRITICAL] Rewrite homepage H1 and first paragraph** (Effort: 30 min | Impact: High)
- [ ] **[HIGH] Add keyword-rich image alt text** (Effort: 15 min | Impact: Medium)

---

## 6. Core Web Vitals & Performance

### 6.1 Current Assessment

Could not run a direct PageSpeed Insights test due to proxy restrictions. However, given that the site is a web application (likely Next.js or React-based SaaS), common performance concerns include:

- **Large JavaScript bundles** — SaaS apps often ship 500KB+ of JS
- **Client-side rendering** — May not serve content to search engine crawlers
- **Heavy AI/conversion features** — Could slow initial page load

### 6.2 Action Items

- [ ] **[HIGH] Run Google PageSpeed Insights** (Effort: 5 min | Impact: Medium)
  - Go to https://pagespeed.web.dev/
  - Test both mobile and desktop for `invoicetodata.com`
  - Target scores: 90+ Performance, 90+ Accessibility, 90+ Best Practices, 90+ SEO

- [ ] **[HIGH] Verify server-side rendering (SSR) or static generation** (Effort: 15 min | Impact: High)
  - Test by right-clicking → View Source on the homepage
  - If the HTML source shows actual content (not just `<div id="root"></div>`), SSR is working
  - If it's a blank shell, Google may not see your content — this would be a critical issue
  - Fix: Enable SSR/SSG in your framework (Next.js: use `getStaticProps` or server components)

- [ ] **[MEDIUM] Check mobile responsiveness** (Effort: 10 min | Impact: Medium)
  - Google uses mobile-first indexing
  - Test at https://search.google.com/test/mobile-friendly

---

## 7. Internal Linking & Site Architecture

### 7.1 Current State

Based on search results, the site appears to have a minimal page structure (primarily homepage + conversion tool). This severely limits SEO potential.

### 7.2 Recommended Site Architecture

```
invoicetodata.com/                          (homepage — main conversion tool)
├── /features/                               (feature overview page)
│   ├── /features/invoice-ocr               (dedicated OCR feature page)
│   ├── /features/pdf-to-excel              (PDF to Excel feature page)
│   └── /features/multi-format-export       (export capabilities)
├── /use-cases/                              (use case pages)
│   ├── /use-cases/accounts-payable         (AP automation use case)
│   ├── /use-cases/bookkeeping              (bookkeeper use case)
│   └── /use-cases/small-business           (SMB use case)
├── /pricing/                                (pricing page)
├── /blog/                                   (blog hub page)
│   ├── /blog/best-invoice-ocr-software-2026
│   ├── /blog/how-to-extract-data-from-invoices
│   ├── /blog/invoicetodata-vs-nanonets
│   └── /blog/automate-invoice-data-entry
├── /api/                                    (API documentation — for developer audience)
├── /about/                                  (about / company page)
├── /contact/                                (contact page)
└── /privacy/ & /terms/                      (legal pages)
```

### 7.3 Internal Linking Strategy

- [ ] **[HIGH] Create a /blog/ section** (Effort: 2-4 hours | Impact: Critical)
  - This is where the 4 drafted content pieces should be published
  - Each blog post should link to the homepage conversion tool
  - Blog posts should cross-link to each other where relevant

- [ ] **[HIGH] Create dedicated feature/use-case pages** (Effort: 4-8 hours | Impact: High)
  - Each page targets a specific keyword cluster
  - Each page links back to the main conversion tool
  - Creates topical authority and expands indexed page count

- [ ] **[MEDIUM] Add footer navigation** (Effort: 1 hour | Impact: Medium)
  - Include links to all key pages in the footer
  - Helps Google discover and crawl all pages

---

## 8. Canonical Tags & Duplicate Content

- [ ] **[HIGH] Verify canonical tags on all pages** (Effort: 15 min | Impact: Medium)
  - Every page should have: `<link rel="canonical" href="https://invoicetodata.com/PAGE-URL" />`
  - Ensure `www` vs non-`www` and `http` vs `https` are properly redirected
  - Check: Does `http://invoicetodata.com` redirect to `https://invoicetodata.com`?
  - Check: Does `www.invoicetodata.com` redirect to `invoicetodata.com`?

---

## 9. Open Graph & Social Meta Tags

- [ ] **[MEDIUM] Add Open Graph meta tags** (Effort: 20 min | Impact: Medium)

```html
<meta property="og:title" content="Invoice Data Extraction & OCR — InvoiceToData" />
<meta property="og:description" content="AI-powered invoice OCR. Convert PDF invoices to Excel, CSV, or Google Sheets in seconds. Free, no signup." />
<meta property="og:image" content="https://invoicetodata.com/og-image.png" />
<meta property="og:url" content="https://invoicetodata.com/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="InvoiceToData" />
```

- [ ] **[MEDIUM] Add Twitter Card meta tags** (Effort: 10 min | Impact: Low-Medium)

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Invoice Data Extraction & OCR — InvoiceToData" />
<meta name="twitter:description" content="AI-powered invoice OCR. Convert invoices to Excel in seconds." />
<meta name="twitter:image" content="https://invoicetodata.com/twitter-card.png" />
```

---

## 10. Competitive Gap Analysis — Technical SEO

### What Top Competitors Do Differently

| Feature | Klippa | Nanonets | Mindee | InvoiceToData |
|---|---|---|---|---|
| Blog with 50+ posts | ✅ | ✅ | ✅ | ❌ 0 published |
| Schema markup | ✅ SoftwareApp + FAQ | ✅ | ✅ | ❌ None detected |
| Dedicated feature pages | ✅ 10+ pages | ✅ | ✅ | ❌ Minimal |
| Comparison pages | ✅ vs. competitors | ✅ | ✅ | ❌ 0 published |
| API documentation (indexed) | ✅ | ✅ | ✅ | ❓ Unknown |
| Listed on G2/Capterra | ✅ | ✅ | ✅ | ❌ Not listed |
| Multiple indexed pages | 500+ | 200+ | 100+ | 1-3 |
| Optimized title tags | ✅ Keyword-rich | ✅ | ✅ | ❌ Generic |
| Internal linking | ✅ Strong | ✅ | ✅ | ❌ Minimal |
| Mobile-optimized | ✅ | ✅ | ✅ | ❓ Unverified |

### Key Competitor Moves This Week

- **Klippa** continues to dominate content: "Best Automated Invoice Scanning Software for AP in 2026", "Top 5 Invoice Parsing Solutions in 2026", and multiple new blog posts published
- **New competitors gaining traction:** Lido, Parseur, Parsio, docs2excel.ai, OnlineInvoiceConverter — all appearing prominently in search results
- **InvoiceDataExtraction.com** still appearing for "invoice data extraction" and "extract data from invoice" queries — exact-match domain advantage persists
- **Listicle sites** (Koncile, GoTofu, Red Brick Labs, NameQuick, Gennai, ZipDo, TallyScan, WiFi Talents) all publishing "Best Invoice OCR Software 2026" roundups — InvoiceToData is NOT featured in any of them

---

## 11. Priority Action Matrix — Week 3

### 🔴 CRITICAL (Do This Week)

| # | Action | Effort | Impact | Owner |
|---|---|---|---|---|
| 1 | **Change homepage title tag** to include "Invoice Data Extraction" and "Invoice OCR" | 15 min | Very High | Khiem |
| 2 | **Publish the 4 drafted blog posts** on a /blog/ section | 2-4 hrs | Very High | Khiem |
| 3 | **Verify Google Search Console** — check indexation status, submit sitemap | 15 min | Very High | Khiem |
| 4 | **Rewrite homepage H1** to target "extract data from invoices" | 15 min | High | Khiem |

### 🟡 HIGH (Do Within 2 Weeks)

| # | Action | Effort | Impact | Owner |
|---|---|---|---|---|
| 5 | Add SoftwareApplication schema markup | 30 min | High | Khiem |
| 6 | Add Organization + FAQ schema markup | 45 min | Medium-High | Khiem |
| 7 | Create sitemap.xml (if missing) and submit to GSC | 30 min | High | Khiem |
| 8 | Verify SSR/SSG — ensure Google can see page content | 15 min | High | Khiem |
| 9 | Add canonical tags to all pages | 15 min | Medium | Khiem |
| 10 | Create dedicated feature pages (/invoice-ocr, /invoice-to-excel) | 4-8 hrs | High | Khiem |

### 🟢 MEDIUM (Do Within 1 Month)

| # | Action | Effort | Impact | Owner |
|---|---|---|---|---|
| 11 | Add Open Graph + Twitter Card meta tags | 30 min | Medium | Khiem |
| 12 | Run PageSpeed Insights and fix performance issues | 1-2 hrs | Medium | Khiem |
| 13 | Add footer navigation with internal links | 1 hr | Medium | Khiem |
| 14 | Submit to G2, Capterra, Product Hunt | 2-3 hrs | High (backlinks) | Khiem |
| 15 | Create /use-cases/ pages for different audience segments | 4-6 hrs | Medium | Khiem |

---

## 12. Progress Since Campaign Start (March 26)

| Metric | March 26 | April 1 | April 8 | Trend |
|---|---|---|---|---|
| Google indexed pages | 0 | 0 | ~1-3 | 🟡 Slow progress |
| Tier 1 keywords on Page 1 | 0/6 | 0/6 | 0/6 | 🔴 No change |
| Rankings detected | 0 | 0 | 1 (#4 for "invoice to data converter") | 🟢 First ranking! |
| Content pieces published | 0 | 0 | 0 | 🔴 Critical blocker |
| Content pieces drafted | 1 | 1 | 4 | 🟢 Good production |
| Schema markup implemented | None | None | None | 🔴 No change |
| Homepage title optimized | No | No | No | 🔴 No change |
| GSC verified | Unknown | Unknown | Likely yes | 🟡 Unconfirmed |
| Listed on directories | 0 | 0 | 0 | 🔴 No change |

---

## 13. Urgent Message for Khiem

**The #1 thing holding back SEO progress is execution of previously identified recommendations.** The SEO Agent has now produced 4 high-quality content pieces, 2 technical audits, 2 link building strategies, and multiple specific recommendations — but none have been implemented yet.

**If you only do 3 things this week:**

1. **Change the homepage title tag** from "Free AI PDF to Excel Converter" to "Invoice Data Extraction & OCR — Convert Invoices to Excel | InvoiceToData" — this takes 15 minutes and is the single highest-impact change

2. **Publish the blog posts** — even publishing just 1 of the 4 drafted posts would give Google new content to index and new keywords to rank for

3. **Check Google Search Console** — verify your indexation status and submit a sitemap if you haven't already

Every week these remain unimplemented, competitors like Klippa, Lido, and Parseur are publishing new content and strengthening their positions.

---

*Generated by SEO Agent | Next audit: April 15, 2026*
*Previous audit: [tech-audit-2026-04-01.md](../seo-technical/tech-audit-2026-04-01.md)*

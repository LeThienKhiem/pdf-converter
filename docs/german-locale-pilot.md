# German locale pilot — scope before building

Status: **blocked on one cheap verification.** Do not start building.

## Why Germany came up

From the 90-day Search Console country export:

| Country | Impressions | Clicks | Avg position |
|---|---|---|---|
| Germany | **434** | 0 | 31.4 |
| Netherlands | 153 | 0 | 32.2 |
| Philippines | 146 | 0 | 51.0 |
| Malaysia | 141 | 0 | 49.5 |
| Indonesia | 124 | 0 | 47.1 |
| Mexico | 109 | 0 | 55.8 |
| France | 95 | 0 | 50.7 |
| Brazil | 88 | 0 | 52.9 |
| Japan | 77 | 1 | 53.4 |

Germany is the third-highest impression country on the site and has never
produced a click. That is a real, measurable gap.

A handful of non-English queries also appear in the query export, which is
what originally suggested a language problem:

```
pdf 銀行取引明細 excel 変換                    (Japanese)
最高のオンラインpdf抽出ツールは何ですか？        (Japanese)
alternative à nanonets                       (French)
vreau pdf                                    (Romanian)
fiyatları nasıl peki                         (Turkish)
```

## The unknown that decides everything

**We do not know whether German visitors are searching in German or in
English.** The exports on hand are single-dimension — a country report and a
query report, never crossed — and the query report is overwhelmingly English.
Notably, *not one German-language query appears in it at all*, while Japanese,
French, Romanian and Turkish ones do.

That points toward German users reaching the site through English queries. If
that is right, translation is the wrong fix:

- **If German-language queries dominate** → the site is surfacing for German
  terms with English pages. Translation is exactly the lever. Build the pilot.
- **If English queries dominate** → these are German users searching in
  English, already finding us, and bouncing at position 31 because page 3-4
  gets almost no clicks regardless of language. Translation buys nothing;
  ranking and titles do. **Skip the pilot entirely.**

Position 31.4 is itself evidence for the second reading. Almost nothing on
page 3-4 gets clicked in any language, so "0 clicks" is fully explained by
rank alone and needs no language hypothesis.

### How to check (about 15 minutes, no code)

1. Search Console → Performance
2. Filter: Country = Germany
3. Open the **Queries** tab
4. Read the top 20-30 queries and judge the language split

Also worth capturing while there: Country = Germany → **Pages** tab, to see
which pages Germany actually lands on. If they are all English-intent pages
like `/tools/pdf-to-excel`, that reinforces the second reading.

Export both and this document can be settled definitively.

## If the check says "build it" — actual scope

Not a small job. Honest breakdown:

**Routing.** App Router has no built-in i18n routing (unlike the old Pages
Router `i18n` config). Needs a `app/[locale]/` segment, which means moving
essentially every existing route under it, plus middleware for locale
detection and default-locale handling. This repo already has a `middleware`
file, and Next 16 is warning that the convention is deprecated in favour of
`proxy` — worth resolving that first rather than building on top of it.

**hreflang.** Every page needs reciprocal `alternates.languages` entries, and
`app/sitemap.ts` needs per-locale entries. The sitemap is currently 8 static
routes plus three database-driven groups (`landing_pages`, bank slugs, blog
posts) — each of those loops has to become locale-aware. Missing or
non-reciprocal hreflang is worse than none: Google ignores the whole cluster.

**Content.** This is the real cost, and machine translation is a trap here.
Financial and accounting vocabulary is where it fails hardest — *Kontoauszug*,
*Umsatzsteuer*, *Buchhaltung*, *Sollsaldo* have precise meanings, and a
plausible-but-wrong term reads as unserious to exactly the professional
audience being targeted. Budget for a human reviewer who knows German
accounting, or don't ship it.

Scope options, smallest first:

1. **Three pages only** — `/`, `/tools/pdf-to-excel`,
   `/tools/bank-statement-to-excel`. Proves or disproves the thesis at
   minimum cost. The 120 blog posts stay English.
2. **Three pages + German bank entities** — add Deutsche Bank, Commerzbank,
   Sparkasse, DKB, N26, ING to `lib/bankEntities.ts` with German copy. The
   programmatic bank template already works and is the cheapest content per
   page on the site, so this is unusually good value *if* the language
   thesis holds.
3. **Full corpus** — do not consider this until option 1 has produced
   German clicks.

**Sequencing note.** Option 2's German bank entities are worth adding to the
*English* site regardless of the language question. "Deutsche Bank statement
to Excel" is a query an English-speaking finance team at a German subsidiary
would type, and the bank pages already rank (Chase: 363 impressions). That
part carries no i18n risk and can ship independently.

## Recommendation

Run the 15-minute check first. Everything else here is contingent on it, and
the current evidence leans toward "don't translate — fix ranking".

Regardless of the outcome, add the German banks to `lib/bankEntities.ts` in
English. That has independent value and no downside.

Do not start the routing refactor until the query-language split is known.

/**
 * Layer 1 — Pre-generation dedup gate.
 *
 * Before spending a full Sonnet call on a 2000-word article, we ask Haiku to
 * propose N candidate angles AND score each one's similarity against the
 * existing corpus in a single tool-use call. We then pick the most distinct
 * angle (or skip the run entirely) before paying for the long-form write.
 *
 * Cost per run: ~3-5k input tokens + ~1.5k output tokens on Haiku (~$0.001).
 * Saved: when an angle would have produced a duplicate, we skip the ~$0.05
 * Sonnet write entirely instead of publishing a near-duplicate.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, PDF_MODEL } from "@/lib/anthropic";

/** A candidate article angle proposed by the planner. */
export type Candidate = {
  title: string;
  summary: string;
  headings: string[];
  most_similar_title: string;
  similarity_score: number; // 0-100; 100 = covers identical ground
  novelty_pitch: string;
};

export type RecentPost = {
  title: string;
  /** Short summary; falls back to title-only when null (legacy posts). */
  summary?: string | null;
};

const PROPOSE_TOOL: Anthropic.Tool = {
  name: "propose_angles",
  description:
    "Propose distinct candidate article angles for an SEO blog and score each one's overlap with the existing corpus. Always return exactly the requested count of candidates.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: "Distinct candidate angles, ordered by novelty (most novel first).",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "SEO-optimized H1 title (50-65 chars ideal).",
            },
            summary: {
              type: "string",
              description:
                "60-80 word description of the article's angle, primary takeaway, and unique element vs the corpus.",
            },
            headings: {
              type: "array",
              items: { type: "string" },
              description: "5-8 H2 section headings, in the order they will appear.",
            },
            most_similar_title: {
              type: "string",
              description:
                "Exact title of the single most-similar existing post from the corpus, or 'NONE' if no real overlap.",
            },
            similarity_score: {
              type: "number",
              description:
                "0-100 score of topical/structural overlap with the most-similar existing post. 0 = entirely fresh ground; 50 = adjacent topic, different angle; 80 = same topic, different framing; 100 = essentially the same article.",
            },
            novelty_pitch: {
              type: "string",
              description:
                "One sentence on what makes this angle distinct from the corpus (a different reader, a different data point, a contrarian take, a new sub-topic, etc).",
            },
          },
          required: [
            "title",
            "summary",
            "headings",
            "most_similar_title",
            "similarity_score",
            "novelty_pitch",
          ],
        },
      },
    },
    required: ["candidates"],
  },
};

function formatCorpus(recentPosts: RecentPost[]): string {
  if (recentPosts.length === 0) return "(no existing posts yet)";
  return recentPosts
    .map((p, i) => {
      const summaryPart = p.summary?.trim()
        ? `\n   Summary: ${p.summary.trim()}`
        : "";
      return `${i + 1}. "${p.title}"${summaryPart}`;
    })
    .join("\n");
}

export async function proposeAndScoreCandidates(opts: {
  templatePrompt: string;
  templateType: string;
  recentPosts: RecentPost[];
  count?: number;
  /** Optional Layer-3 diversity dials. When provided, the planner anchors all
   *  candidates to this combo so the writer downstream gets a coherent brief. */
  axes?: DiversityAxes;
  client?: Anthropic;
}): Promise<Candidate[]> {
  const count = opts.count ?? 3;
  const client = opts.client ?? getAnthropic();

  const corpusBlock = formatCorpus(opts.recentPosts);
  const axesBlock = opts.axes ? `\n\n${formatDiversityAxes(opts.axes)}` : "";

  const userPrompt = `You are planning the next blog post for InvoiceToData (an AI invoice/PDF data-extraction SaaS).

TEMPLATE TYPE: ${opts.templateType}
TEMPLATE BRIEF:
${opts.templatePrompt}${axesBlock}

EXISTING CORPUS (most recent first — DO NOT propose angles that retread these):
${corpusBlock}

YOUR TASK:
Propose exactly ${count} distinct candidate angles that fit the template brief but are clearly differentiated from the corpus above. For EACH candidate:
- Give it a real, SEO-ready H1 title.
- Write a 60-80 word summary describing the angle and the unique element.
- List 5-8 H2 section headings.
- Identify the SINGLE most-similar existing post (exact title, or "NONE" if no real overlap).
- Score similarity 0-100 (be honest: if it's the same topic with a fresh framing, that's still ~70-80, not 30).
- Pitch the novelty in one sentence.

${
  opts.axes
    ? "All candidates MUST honor the diversity dials above (persona, format, depth) — vary the topic across candidates, not the dials."
    : "Diversity heuristics: vary persona, format, depth across candidates. Prefer angles with a specific number, named tool, or named industry not yet in the corpus."
}

Return via the propose_angles tool.`;

  const response = await client.messages.create({
    model: PDF_MODEL, // claude-haiku-4-5 — fast and cheap
    max_tokens: 2048,
    tools: [PROPOSE_TOOL],
    tool_choice: { type: "tool", name: "propose_angles" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolBlock) {
    throw new Error("Planner returned no tool_use block");
  }
  const input = toolBlock.input as { candidates?: Candidate[] };
  const candidates = input.candidates ?? [];
  if (candidates.length === 0) {
    throw new Error("Planner returned zero candidates");
  }
  return candidates;
}

/**
 * Pick the candidate with the lowest similarity score below the threshold.
 * Returns null when every candidate is too similar to the corpus — the caller
 * should skip publishing for this run instead of forcing a duplicate.
 */
export function pickBestCandidate(
  candidates: Candidate[],
  threshold = 65
): Candidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) => a.similarity_score - b.similarity_score
  );
  const best = sorted[0];
  if (best.similarity_score >= threshold) return null;
  return best;
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 1b — Mechanical dedup check (independent of the planner)
//
// Layer 1 asks Haiku to score its OWN proposal's similarity, then filters on
// that self-report. An audit of the live corpus (120 posts) found 34
// near-duplicate title pairs, 23 of which were inside the window the planner
// could see — it simply under-scored them. Self-grading is not a gate.
//
// This module re-checks the chosen candidate in plain code, so a lowballed
// similarity_score can no longer wave a duplicate through.
//
// Why not raw title Jaccard alone: this corpus has heavy title boilerplate
// ("Best Alternatives to X: Top 7 Invoice OCR Solutions for 2026"). Measured
// on the real corpus, "Best Alternatives to Rossum…" vs "Best Alternatives to
// ABBYY…" scores 0.40 — the same as genuinely distinct pairs — because the
// shared scaffolding dominates. So overlap alone would either block real
// articles or miss real dupes.
//
// The fix: overlap gates the check, but a candidate survives if it introduces
// a DISTINCTIVE token the matched post lacks (a new competitor, bank, doc
// type, industry). "Rossum" vs "ABBYY" differ that way and pass; the exact
// re-publish of "Invoice OCR Pricing Comparison 2026" introduces nothing and
// is blocked.
// ─────────────────────────────────────────────────────────────────────────

/** Words too generic to signal topical overlap in this corpus. */
const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "your",
  "you", "how", "what", "why", "is", "are", "vs", "best", "top", "guide",
  "2026", "2025", "2024", "it", "that", "this", "from", "at", "by", "as", "be",
  "can", "complete", "ultimate", "step", "steps", "into", "not", "no", "my",
  "our", "when", "where", "which", "who", "will", "should", "does", "do",
]);

/** Collapse a title to a comparable form for exact-duplicate detection. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content-bearing tokens of a title, stopwords and short words removed. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Tokens that appear in >= 15% of corpus titles are treated as this site's
 * boilerplate vocabulary ("invoice" is in 71% of titles, "ocr" in 33%) and
 * therefore carry no differentiating signal.
 */
function boilerplateTokens(corpus: RecentPost[]): Set<string> {
  const freq = new Map<string, number>();
  for (const post of corpus) {
    for (const token of titleTokens(post.title)) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  const cutoff = Math.max(2, Math.ceil(corpus.length * 0.15));
  const common = new Set<string>();
  for (const [token, n] of freq) if (n >= cutoff) common.add(token);
  return common;
}

export type DupeVerdict = {
  /** True when the candidate should NOT be published. */
  isDupe: boolean;
  /** Highest title overlap found against the corpus, 0-1. */
  score: number;
  /** The corpus title that drove the score. */
  closestTitle: string;
  /** Human-readable rationale for the Telegram alert. */
  reason: string;
};

/** Overlap at or above this, with no new distinctive token, blocks publish. */
const MECHANICAL_BLOCK_AT = 0.45;

/**
 * Above this, nothing rescues the candidate.
 *
 * Set from a replay of the live corpus: at 80% overlap, "How to Switch to
 * Invoice Automation in 2026: A Step-by-Step Migration Guide for Businesses"
 * was escaping the gate purely because it added the word "businesses" — the
 * distinctive-term escape hatch is meaningless once overlap is this high.
 */
const MECHANICAL_HARD_BLOCK_AT = 0.65;

/**
 * Rhetorical and structural words that must never count as a distinctive
 * term. They pass the corpus-frequency filter (each appears in well under
 * 15% of titles) yet carry no topical differentiation, so without this list
 * they rescue genuine duplicates. Kept separate from TITLE_STOPWORDS because
 * these SHOULD still contribute to the overlap score — they just can't be
 * the thing that makes an article "new".
 */
const NON_DISTINCTIVE = new Set([
  "business", "businesses", "company", "companies", "team", "teams",
  "proven", "ways", "tips", "guide", "guides", "choose", "choosing",
  "automatically", "automated", "automating", "automation",
  "scaling", "switch", "switching", "transforming", "transform",
  "efficiency", "accuracy", "workflow", "workflows", "process", "processing",
  "solution", "solutions", "tool", "tools", "software", "platform",
  "comparison", "compared", "review", "reviews", "explained", "understanding",
  "everything", "need", "know", "real", "true", "hidden", "secret",
  "guide2026", "guide2025",
]);

/**
 * Re-check a candidate title against the FULL corpus in code. Runs after the
 * planner has chosen, and can veto that choice.
 */
export function mechanicalDupeCheck(
  candidateTitle: string,
  corpus: RecentPost[]
): DupeVerdict {
  if (corpus.length === 0) {
    return { isDupe: false, score: 0, closestTitle: "", reason: "empty corpus" };
  }

  const candidateNorm = normalizeTitle(candidateTitle);
  const candidateTokens = titleTokens(candidateTitle);
  const boilerplate = boilerplateTokens(corpus);

  let worstScore = 0;
  let closestTitle = "";
  let closestTokens = new Set<string>();

  for (const post of corpus) {
    // An identical title is a duplicate regardless of any other signal.
    if (normalizeTitle(post.title) === candidateNorm) {
      return {
        isDupe: true,
        score: 1,
        closestTitle: post.title,
        reason: "exact title match against an existing post",
      };
    }
    const score = jaccard(candidateTokens, titleTokens(post.title));
    if (score > worstScore) {
      worstScore = score;
      closestTitle = post.title;
      closestTokens = titleTokens(post.title);
    }
  }

  if (worstScore < MECHANICAL_BLOCK_AT) {
    return {
      isDupe: false,
      score: worstScore,
      closestTitle,
      reason: `overlap ${(worstScore * 100).toFixed(0)}% is below the ${(MECHANICAL_BLOCK_AT * 100).toFixed(0)}% gate`,
    };
  }

  if (worstScore >= MECHANICAL_HARD_BLOCK_AT) {
    return {
      isDupe: true,
      score: worstScore,
      closestTitle,
      reason: `overlap ${(worstScore * 100).toFixed(0)}% exceeds the ${(MECHANICAL_HARD_BLOCK_AT * 100).toFixed(0)}% hard ceiling — no new angle can justify this much reuse`,
    };
  }

  // Moderate overlap. Survive only by introducing a genuinely topical term the
  // closest post lacks — a new competitor, bank, document type, or industry.
  // Generic modifiers are excluded so they can't rescue a near-duplicate.
  const newDistinctive = [...candidateTokens].filter(
    (t) => !boilerplate.has(t) && !closestTokens.has(t) && !NON_DISTINCTIVE.has(t)
  );

  if (newDistinctive.length > 0) {
    return {
      isDupe: false,
      score: worstScore,
      closestTitle,
      reason: `overlap ${(worstScore * 100).toFixed(0)}% but introduces new distinctive term(s): ${newDistinctive.join(", ")}`,
    };
  }

  return {
    isDupe: true,
    score: worstScore,
    closestTitle,
    reason: `overlap ${(worstScore * 100).toFixed(0)}% with no distinctive term the existing post lacks`,
  };
}

/**
 * Rank corpus posts by topical relevance to a seed text (the chosen angle's
 * title + keywords) so internal links point at genuinely related posts.
 *
 * Replaces the previous "5 most recent posts" heuristic, which concentrated
 * every internal link on the newest handful and left the rest of the corpus
 * orphaned — the measured cause of high-impression older posts stalling at
 * position 60-85 with no path to accumulate internal link equity.
 */
export function pickRelevantLinkTargets<T extends { title: string; slug: string }>(
  seedText: string,
  corpus: T[],
  count = 6
): T[] {
  const seedTokens = titleTokens(seedText);
  const boilerplate = boilerplateTokens(
    corpus.map((c) => ({ title: c.title }))
  );

  // Score on distinctive overlap only, so shared boilerplate ("invoice",
  // "ocr") doesn't make every post look equally relevant.
  const scored = corpus.map((post) => {
    const postTokens = titleTokens(post.title);
    let shared = 0;
    for (const token of seedTokens) {
      if (token !== "" && !boilerplate.has(token) && postTokens.has(token)) shared++;
    }
    return { post, score: shared };
  });

  const related = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  // Top up with the least-recently-surfaced posts when relevance is thin, so
  // a run still spreads equity instead of falling back to the newest few.
  const chosen = related.slice(0, count).map((s) => s.post);
  if (chosen.length < count) {
    const chosenSlugs = new Set(chosen.map((c) => c.slug));
    for (let i = corpus.length - 1; i >= 0 && chosen.length < count; i--) {
      if (!chosenSlugs.has(corpus[i].slug)) {
        chosen.push(corpus[i]);
        chosenSlugs.add(corpus[i].slug);
      }
    }
  }
  return chosen;
}

/**
 * Generate a 60-80 word summary for an existing article. Used by the backfill
 * route so we can populate the new `summary` column on legacy posts without
 * regenerating the article. One Haiku call per post (~$0.0003 each).
 */
export async function summarizeExistingPost(opts: {
  title: string;
  content: string;
  client?: Anthropic;
}): Promise<string> {
  const client = opts.client ?? getAnthropic();
  // Cap input to first ~1500 chars to keep tokens predictable; the lead and
  // first H2 carry almost all the angle signal anyway.
  const snippet = opts.content.slice(0, 1500);
  const response = await client.messages.create({
    model: PDF_MODEL,
    max_tokens: 250,
    messages: [
      {
        role: "user",
        content: `Write a 60-80 word summary of this blog post. Capture the angle, the primary takeaway, and any specific entity (tool name, industry, persona) that distinguishes it. Plain prose only — no markdown, no preamble.

TITLE: ${opts.title}

CONTENT (first 1500 chars):
${snippet}`,
      },
    ],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Helper for cron files: format a chosen candidate as a "locked outline" block
 * to inject into the Sonnet writer prompt. Keeps the writer from drifting
 * back to generic structure.
 */
export function formatLockedAngle(angle: Candidate): string {
  return `LOCKED ANGLE — you MUST follow this exact angle and outline:
- Title: ${angle.title}
- Angle: ${angle.summary}
- Novelty (this is what makes the post different from existing ones): ${angle.novelty_pitch}
- Required H2 sections (use these in this order, you may add ### subsections inside each):
${angle.headings.map((h) => `  - ${h}`).join("\n")}

Do NOT drift to a more generic outline. Do NOT skip or rename the H2 sections above. The whole point of this brief is to publish content that doesn't repeat what we already have.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 3 — Diversity axes
//
// Even with topic-level dedup (Layer 1), articles can still feel same-y if
// every post uses the same persona, format, and depth. We roll dice across
// three small pools each run; ~6×7×3 = 126 combos means natural variety
// without needing a "no-repeat" history table.
// ─────────────────────────────────────────────────────────────────────────

export type AxisOption<T = unknown> = { label: string; value: T };

export type Persona = {
  label: string;
  description: string;
};

export type FormatStyle = {
  label: string;
  description: string;
};

export type Depth = {
  label: string;
  minWords: number;
  maxWords: number;
  description: string;
};

const PERSONAS: Persona[] = [
  {
    label: "CFO of a 50-person SaaS",
    description:
      "Strategic, ROI-obsessed, talks in terms of close-cycle days and audit risk. Cares about scale and exception rates, not button clicks.",
  },
  {
    label: "Solo bookkeeper serving 20 SMB clients",
    description:
      "Hands-on, time-poor, juggles multiple tools. Values workflows that fit between client appointments. Allergic to enterprise jargon.",
  },
  {
    label: "Junior accountant in their first month-end close",
    description:
      "Anxious about getting things right. Wants step-by-step clarity, screenshots, and 'gotchas' you only learn from experience.",
  },
  {
    label: "Skeptical product reviewer",
    description:
      "Treats vendor claims as marketing fluff until proven. Likes tradeoffs, edge cases, and honest 'when this falls over' commentary.",
  },
  {
    label: "Operations lead at a fast-growing e-commerce brand",
    description:
      "Drowning in 3PL invoices, ad receipts, and payment processor fees. Wants throughput and integration with existing tools more than perfection.",
  },
  {
    label: "Audit/compliance partner at a mid-tier firm",
    description:
      "Cares about traceability, sampling, document retention. Skeptical of any 'AI-extracted' figure that lacks a deterministic re-check.",
  },
];

const FORMATS: FormatStyle[] = [
  {
    label: "Deep teardown",
    description:
      "Pick one specific tool, workflow, or PDF format and dissect it in granular detail with concrete examples.",
  },
  {
    label: "Contrarian opinion",
    description:
      "Take a position the mainstream advice gets wrong (e.g. 'Why batch invoice processing is overrated for most SMBs'). Defend it with reasoning, not vibes.",
  },
  {
    label: "Data-driven analysis",
    description:
      "Lead with numbers — costs, time, error rates, market sizes — and let the structure follow the data. Use tables liberally.",
  },
  {
    label: "Step-by-step walkthrough",
    description:
      "Concrete procedure with numbered steps, expected outputs at each step, and what to do when things break.",
  },
  {
    label: "Side-by-side comparison",
    description:
      "Two or more options compared on identical dimensions. Comparison table is the centerpiece, not an afterthought.",
  },
  {
    label: "Day-in-the-life narrative",
    description:
      "Tell a small story of one person doing the work, before and after. Specific names, specific timestamps, specific friction points.",
  },
  {
    label: "Decision framework",
    description:
      "Give the reader a structured way to choose: questions to ask themselves, branches based on answers, recommendations per branch.",
  },
];

const DEPTHS: Depth[] = [
  {
    label: "Quickstart",
    minWords: 1100,
    maxWords: 1500,
    description: "Tight, scannable, gets to the point. No filler sections.",
  },
  {
    label: "Standard deep-dive",
    minWords: 1800,
    maxWords: 2500,
    description: "Default depth for an SEO long-form. Room for tables, FAQ, examples.",
  },
  {
    label: "Ultimate guide",
    minWords: 3000,
    maxWords: 4000,
    description:
      "Comprehensive coverage with table of contents, multiple subsections per H2, several tables. Built to outrank shallower competitors.",
  },
];

export type DiversityAxes = {
  persona: Persona;
  format: FormatStyle;
  depth: Depth;
};

function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Roll a fresh (persona × format × depth) combo for this run. No state — we
 * rely on Layer 1's topic dedup to prevent overall repetition; this just
 * varies the texture so adjacent topics don't read identically.
 */
export function pickDiversityAxes(): DiversityAxes {
  return {
    persona: pickRandom(PERSONAS),
    format: pickRandom(FORMATS),
    depth: pickRandom(DEPTHS),
  };
}

export function formatDiversityAxes(axes: DiversityAxes): string {
  return `DIVERSITY DIALS for this article (use ALL three — they are not optional flavor):
- Reader persona: ${axes.persona.label}
  → ${axes.persona.description}
- Format: ${axes.format.label}
  → ${axes.format.description}
- Depth: ${axes.depth.label} (${axes.depth.minWords}-${axes.depth.maxWords} words)
  → ${axes.depth.description}

Write FOR this persona, IN this format, AT this depth. The combination should be obvious to anyone reading — generic SEO content is the failure mode we're trying to escape.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Layer 2 — Critic gate
//
// After Sonnet writes the draft but BEFORE we publish, run a cheap Haiku
// critic that checks for specific failure modes (no concrete numbers, no
// named entities, generic FAQ, structural drift from the locked angle).
// On fail we surface to Telegram instead of auto-retrying — a retry costs
// another full Sonnet call, and the failure usually means the angle was
// weak rather than the prose.
// ─────────────────────────────────────────────────────────────────────────

export type CriticVerdict = {
  pass: boolean;
  scores: {
    specificNumbers: number; // count of concrete stats/numbers found
    namedEntities: number; // count of named tools/products/companies
    faqQuality: number; // 0-100
    structuralFit: number; // 0-100, how well it follows the locked outline
  };
  issues: string[]; // human-readable problem list
  rewriteHint: string; // one-sentence guidance for next attempt
};

const CRITIC_TOOL: Anthropic.Tool = {
  name: "score_draft",
  description:
    "Score a draft SEO blog post against quality gates. Be strict: it's better to bounce a mediocre draft than publish slop.",
  input_schema: {
    type: "object",
    properties: {
      specificNumbers: {
        type: "number",
        description:
          "Count of concrete numbers/statistics that aren't just years (e.g. '$0.20 per page', '15 minutes saved', '99.2% accuracy'). Do NOT count vague phrases like 'thousands of businesses'.",
      },
      namedEntities: {
        type: "number",
        description:
          "Count of distinct named tools, products, companies, or industry frameworks mentioned (e.g. QuickBooks, ABBYY, Form W-9). Do NOT count InvoiceToData itself.",
      },
      faqQuality: {
        type: "number",
        description:
          "0-100 score for the FAQ section: 100 = specific questions a real reader would search, with substantive answers; 50 = generic 'What is X?' with shallow answers; 0 = missing or filler.",
      },
      structuralFit: {
        type: "number",
        description:
          "0-100 score for how faithfully the article follows the LOCKED ANGLE outline given upstream. 100 = followed exactly; 60 = mostly followed but renamed sections; 0 = ignored the outline entirely. Pass 100 if no locked angle was provided.",
      },
      issues: {
        type: "array",
        items: { type: "string" },
        description:
          "Concrete, fixable problems. Each item one short sentence. Empty array if the draft passes all gates.",
      },
      rewriteHint: {
        type: "string",
        description:
          "One sentence of guidance for what would make the next draft pass — specific, not generic.",
      },
    },
    required: [
      "specificNumbers",
      "namedEntities",
      "faqQuality",
      "structuralFit",
      "issues",
      "rewriteHint",
    ],
  },
};

/** Minimum thresholds for an article to pass the critic gate. */
const CRITIC_MIN = {
  specificNumbers: 3,
  namedEntities: 1,
  faqQuality: 60,
  structuralFit: 70,
};

export async function criticReview(opts: {
  title: string;
  content: string;
  /** The locked angle's summary, if any. Lets the critic score structuralFit. */
  angleSummary?: string;
  client?: Anthropic;
}): Promise<CriticVerdict> {
  const client = opts.client ?? getAnthropic();

  // Send the FULL article to the critic. Earlier we capped at 6000 chars to
  // save tokens, but the FAQ section lives at the END of every article, so
  // truncation produced false-positive "no FAQ" + "draft cut off" verdicts.
  // Full article ~15-25k chars (~4-6k tokens) costs ~$0.005 on Haiku — worth
  // it to get accurate scores. Hard cap at 28000 chars as a runaway guard.
  const fullArticle =
    opts.content.length > 28000 ? opts.content.slice(0, 28000) : opts.content;
  const wasTruncated = opts.content.length > 28000;

  const userPrompt = `Score this draft blog post against the quality gates defined in the score_draft tool. Be strict — we'd rather bounce a mediocre draft than publish slop.

TITLE: ${opts.title}

${opts.angleSummary ? `INTENDED ANGLE: ${opts.angleSummary}\n\n` : ""}DRAFT (${wasTruncated ? "first 28000 chars of a longer article — assume FAQ + Conclusion exist beyond this slice and do NOT penalize for them being missing here" : "complete article"}):
${fullArticle}`;

  const response = await client.messages.create({
    model: PDF_MODEL,
    max_tokens: 1024,
    tools: [CRITIC_TOOL],
    tool_choice: { type: "tool", name: "score_draft" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolBlock) {
    // Critic infrastructure failed — fail open (publish) rather than block
    // the entire content pipeline. Log for visibility.
    console.error("[Critic] No tool_use block in response — failing open");
    return {
      pass: true,
      scores: { specificNumbers: 0, namedEntities: 0, faqQuality: 0, structuralFit: 0 },
      issues: ["critic infrastructure failure (fail-open)"],
      rewriteHint: "n/a — critic call did not return a structured verdict",
    };
  }

  const input = toolBlock.input as {
    specificNumbers: number;
    namedEntities: number;
    faqQuality: number;
    structuralFit: number;
    issues: string[];
    rewriteHint: string;
  };

  const pass =
    input.specificNumbers >= CRITIC_MIN.specificNumbers &&
    input.namedEntities >= CRITIC_MIN.namedEntities &&
    input.faqQuality >= CRITIC_MIN.faqQuality &&
    input.structuralFit >= CRITIC_MIN.structuralFit;

  return {
    pass,
    scores: {
      specificNumbers: input.specificNumbers,
      namedEntities: input.namedEntities,
      faqQuality: input.faqQuality,
      structuralFit: input.structuralFit,
    },
    issues: input.issues ?? [],
    rewriteHint: input.rewriteHint ?? "",
  };
}

export function formatCriticVerdict(verdict: CriticVerdict): string {
  const s = verdict.scores;
  const lines = [
    `Scores: numbers=${s.specificNumbers} (need ≥${CRITIC_MIN.specificNumbers}), entities=${s.namedEntities} (need ≥${CRITIC_MIN.namedEntities}), faq=${s.faqQuality}/100 (need ≥${CRITIC_MIN.faqQuality}), structure=${s.structuralFit}/100 (need ≥${CRITIC_MIN.structuralFit})`,
  ];
  if (verdict.issues.length > 0) {
    lines.push("Issues:");
    verdict.issues.slice(0, 5).forEach((i) => lines.push(`  • ${i}`));
  }
  if (verdict.rewriteHint) {
    lines.push(`Hint for next try: ${verdict.rewriteHint}`);
  }
  return lines.join("\n");
}

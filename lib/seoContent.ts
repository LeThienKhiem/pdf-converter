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

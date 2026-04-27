import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    _client = new Anthropic({ apiKey, maxRetries: 3 });
  }
  return _client;
}

/** Cheap + fast model for PDF / image extraction. */
export const PDF_MODEL = "claude-haiku-4-5";

/** Higher-quality model for long-form SEO content generation. */
export const SEO_MODEL = "claude-sonnet-4-6";

export function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Parse a JSON array from a model response that may include preamble,
 * postamble, or markdown fences around the JSON. Returns null if no
 * valid array can be extracted.
 */
export function parseJsonArrayLoose(text: string): unknown | null {
  if (!text) return null;
  // Strip common markdown fences first.
  const cleaned = text.replace(/```json|```/g, "").trim();
  // Walk to the first '[' and last ']' so any wrapping prose is dropped.
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket <= firstBracket) return null;
  const slice = cleaned.slice(firstBracket, lastBracket + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

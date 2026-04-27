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

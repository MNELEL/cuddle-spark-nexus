/**
 * Server-only embeddings helper.
 * Uses Lovable AI Gateway with openai/text-embedding-3-small (1536 dims).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !text.trim()) return null;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!resp.ok) {
      console.error("[Embedding Error]", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    const j = (await resp.json()) as { data?: { embedding?: number[] }[] };
    return j.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[Embedding Error]", e);
    return null;
  }
}

/** Format a vector for direct SQL injection (pgvector expects '[1,2,3]'). */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
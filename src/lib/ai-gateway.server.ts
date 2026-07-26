// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMessage = any;

export interface CallLovableAIParams {
  messages: AnyMessage[];
  jsonResponse?: boolean;
  model?: string;
}

/**
 * Shared Lovable AI Gateway chat/completions caller.
 * Preserves the exact request shape, headers, and error handling that were
 * duplicated across ai-grades / ai-certificate / bulletin-sync / ai-assistant.
 *
 * Returns the extracted `choices[0].message.content` string (empty string
 * fallback), leaving JSON parsing / business logic to the caller.
 */
export async function callLovableAI(params: CallLovableAIParams): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

  const body: Record<string, unknown> = {
    model: params.model ?? "google/gemini-2.5-flash",
    messages: params.messages,
  };
  if (params.jsonResponse) body.response_format = { type: "json_object" };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 429) throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.");
  if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI. הוסף קרדיטים בהגדרות.");
  if (!resp.ok) {
    console.error("[AI Gateway Error]", resp.status, await resp.text().catch(() => ""));
    throw new Error(`שגיאת AI: ${resp.status}`);
  }

  const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Shared Lovable AI Gateway embeddings caller.
 * Returns `null` on any failure (missing key, HTTP error, malformed response)
 * to preserve the existing non-throwing embeddings contract.
 */
export async function callLovableAIEmbeddings(
  text: string,
  model = "openai/text-embedding-3-small",
): Promise<number[] | null> {
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
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
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
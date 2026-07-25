import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

// Re-export for callers wanting a typed message shape (optional).
export type { ChatCompletionMessageParam };
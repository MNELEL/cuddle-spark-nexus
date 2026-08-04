// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMessage = any;

export interface CallLovableAIParams {
  messages: AnyMessage[];
  jsonResponse?: boolean;
  model?: string;
}

/* ------------------------------------------------------------------ *
 * Circuit breaker (shared between chat + embeddings)
 * ------------------------------------------------------------------ *
 * Both callers hit the same Lovable AI Gateway quota, so a quota /
 * credit failure observed by one must short-circuit the other too.
 * In-memory + per-instance on purpose: resets on restart, no DB.
 */

type BreakerReason = "rate_limited" | "no_credits" | "no_key";

type BreakerState =
  | { kind: "closed" }
  | { kind: "open"; reason: BreakerReason; message: string; until: number };

const BREAKER_WINDOW_MS: Record<BreakerReason, number> = {
  // 429 recovers on its own.
  rate_limited: 60_000,
  // 402 / missing key do not self-heal, but allow a single probe every
  // 5 minutes so adding credits or a key works without a restart.
  no_credits: 300_000,
  no_key: 300_000,
};

let breaker: BreakerState = { kind: "closed" };

/** Returns the Hebrew error message when the breaker is open and still in window. */
function breakerBlockedMessage(): string | null {
  if (breaker.kind === "closed") return null;
  if (Date.now() >= breaker.until) return null; // window elapsed -> allow one probe
  return breaker.message;
}

function openBreaker(reason: BreakerReason, message: string): void {
  breaker = { kind: "open", reason, message, until: Date.now() + BREAKER_WINDOW_MS[reason] };
  console.warn("[AI Breaker] open", reason);
}

function closeBreaker(): void {
  if (breaker.kind !== "closed") {
    breaker = { kind: "closed" };
    console.info("[AI Breaker] closed");
  }
}

const MSG_RATE_LIMITED = "חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.";
const MSG_NO_CREDITS = "נגמרו קרדיטים ב-Lovable AI. הוסף קרדיטים בהגדרות.";
const MSG_NO_KEY = "חסר LOVABLE_API_KEY";

/**
 * Shared Lovable AI Gateway chat/completions caller.
 * Preserves the exact request shape, headers, and error handling that were
 * duplicated across ai-grades / ai-certificate / bulletin-sync / ai-assistant.
 *
 * Returns the extracted `choices[0].message.content` string (empty string
 * fallback), leaving JSON parsing / business logic to the caller.
 */
export async function callLovableAI(params: CallLovableAIParams): Promise<string> {
  const blocked = breakerBlockedMessage();
  if (blocked) throw new Error(blocked);

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    openBreaker("no_key", MSG_NO_KEY);
    throw new Error(MSG_NO_KEY);
  }

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

  if (resp.status === 429) {
    openBreaker("rate_limited", MSG_RATE_LIMITED);
    throw new Error(MSG_RATE_LIMITED);
  }
  if (resp.status === 402) {
    openBreaker("no_credits", MSG_NO_CREDITS);
    throw new Error(MSG_NO_CREDITS);
  }
  if (!resp.ok) {
    // Transient / request-level failures are not quota signals.
    console.error("[AI Gateway Error]", resp.status, await resp.text().catch(() => ""));
    throw new Error(`שגיאת AI: ${resp.status}`);
  }

  closeBreaker();
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
  if (!text.trim()) return null;
  const blocked = breakerBlockedMessage();
  if (blocked) {
    console.error("[Embedding Error] breaker open:", blocked);
    return null;
  }
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    openBreaker("no_key", MSG_NO_KEY);
    return null;
  }
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
    if (resp.status === 429) {
      openBreaker("rate_limited", MSG_RATE_LIMITED);
      return null;
    }
    if (resp.status === 402) {
      openBreaker("no_credits", MSG_NO_CREDITS);
      return null;
    }
    if (!resp.ok) {
      console.error("[Embedding Error]", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    closeBreaker();
    const j = (await resp.json()) as { data?: { embedding?: number[] }[] };
    return j.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[Embedding Error]", e);
    return null;
  }
}
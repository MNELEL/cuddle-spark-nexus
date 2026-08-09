import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The circuit breaker is module-level in-memory state, so each case imports a
 * fresh copy of the module via `vi.resetModules()`.
 */
async function freshGateway() {
  vi.resetModules();
  return await import("@/lib/ai-gateway.server");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const OK_BODY = { choices: [{ message: { content: "שלום" } }] };
const messages = [{ role: "user", content: "בדיקה" }];

let fetchMock: ReturnType<typeof vi.fn>;
const originalKey = process.env["LOVABLE_API_KEY"];

beforeEach(() => {
  vi.useFakeTimers();
  process.env["LOVABLE_API_KEY"] = "test-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env["LOVABLE_API_KEY"];
  else process.env["LOVABLE_API_KEY"] = originalKey;
});

describe("AI gateway circuit breaker", () => {
  it("opens on 429 and short-circuits further calls without hitting the network", async () => {
    const { callLovableAI } = await freshGateway();
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));

    await expect(callLovableAI({ messages })).rejects.toThrow(/מכסת בקשות/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(callLovableAI({ messages })).rejects.toThrow(/מכסת בקשות/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second request
  });

  it("allows a probe again 60s after a 429", async () => {
    const { callLovableAI } = await freshGateway();
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(callLovableAI({ messages })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59_000);
    await expect(callLovableAI({ messages })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await expect(callLovableAI({ messages })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks for 5 minutes after a 402 (no credits)", async () => {
    const { callLovableAI } = await freshGateway();
    fetchMock.mockResolvedValue(new Response("no credits", { status: 402 }));
    await expect(callLovableAI({ messages })).rejects.toThrow(/קרדיטים/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(120_000);
    await expect(callLovableAI({ messages })).rejects.toThrow(/קרדיטים/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(181_000);
    await expect(callLovableAI({ messages })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a successful probe closes the breaker", async () => {
    const { callLovableAI } = await freshGateway();
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    await expect(callLovableAI({ messages })).rejects.toThrow();

    vi.advanceTimersByTime(61_000);
    fetchMock.mockResolvedValue(jsonResponse(OK_BODY));
    await expect(callLovableAI({ messages })).resolves.toBe("שלום");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // breaker closed -> the next call goes straight through
    await expect(callLovableAI({ messages })).resolves.toBe("שלום");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("a plain 500 does not open the breaker", async () => {
    const { callLovableAI } = await freshGateway();
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(callLovableAI({ messages })).rejects.toThrow(/שגיאת AI: 500/);
    await expect(callLovableAI({ messages })).rejects.toThrow(/שגיאת AI: 500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a missing API key opens the breaker without any request", async () => {
    delete process.env["LOVABLE_API_KEY"];
    const { callLovableAI, callLovableAIEmbeddings } = await freshGateway();

    await expect(callLovableAI({ messages })).rejects.toThrow(/LOVABLE_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();

    // the shared breaker also blocks embeddings, which return null instead of throwing
    await expect(callLovableAIEmbeddings("טקסט")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("embeddings share the breaker opened by the chat caller", async () => {
    const { callLovableAI, callLovableAIEmbeddings } = await freshGateway();
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(callLovableAI({ messages })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(callLovableAIEmbeddings("טקסט")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

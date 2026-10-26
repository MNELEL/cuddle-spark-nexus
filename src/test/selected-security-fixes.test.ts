import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readDriveBytes } from "@/lib/drive.server";
import { requireActiveAITrial } from "@/lib/ai-entitlement.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function client(endsAt: string | null, error: unknown = null) {
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { trial_ends_at: endsAt }, error }),
  };
  return { from: () => query } as unknown as SupabaseClient<Database>;
}

describe("selected AI trial enforcement", () => {
  it("allows an active trial", async () => {
    await expect(requireActiveAITrial(client(new Date(Date.now() + 60_000).toISOString()), "user")).resolves.toBeUndefined();
  });
  it("rejects expired and invalid dates", async () => {
    for (const end of ["2000-01-01", "invalid"]) {
      await expect(requireActiveAITrial(client(end), "user")).rejects.toThrow("תקופת הניסיון הסתיימה");
    }
  });
  it("fails closed on lookup errors", async () => {
    await expect(requireActiveAITrial(client("2099-01-01", new Error("offline")), "user")).rejects.toThrow("בדיקת תקופת הניסיון");
  });
  it("gates only the selected implemented actions before AI calls", () => {
    for (const file of ["ai-grades.functions.ts", "ai-daily-summary.functions.ts", "ai-poll.functions.ts"]) {
      const source = readFileSync(`src/lib/${file}`, "utf8");
      expect(source.indexOf("await requireActiveAITrial")).toBeLessThan(source.indexOf("await callLovableAI"));
    }
  });
});

describe("bounded Drive downloads", () => {
  it("preserves supported bytes exactly", async () => {
    const bytes = await readDriveBytes(new Response(new Uint8Array([1, 2, 3])), 3);
    expect([...new Uint8Array(bytes)]).toEqual([1, 2, 3]);
  });
  it("rejects oversized declared responses", async () => {
    await expect(readDriveBytes(new Response("abc", { headers: { "content-length": "100" } }), 3)).rejects.toThrow("גדול");
  });
  it("rejects oversized streamed bytes without a size header", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.enqueue(new Uint8Array([3, 4])); c.close(); } });
    await expect(readDriveBytes(new Response(stream), 3)).rejects.toThrow("גדול");
  });
  it("rejects empty files", async () => {
    await expect(readDriveBytes(new Response(""), 3)).rejects.toThrow("ריק");
  });
});

describe("server-owned prompts and private reminder logs", () => {
  it("never embeds selected free-form fields in system prompts", () => {
    const cases: Record<string, string[]> = {
      "seating-wizard.functions.ts": ["freeInstruction"],
      "ai-grades.functions.ts": ["data.defaultSubject", "data.defaultMax"],
      "ai-exam-generator.functions.ts": ["data.subjects", "data.feedback"],
      "lessons.functions.ts": ["data.extra_instructions", "styleCtx"],
    };
    for (const [file, fields] of Object.entries(cases)) {
      const src = readFileSync(`src/lib/${file}`, "utf8");
      const prompts = [...src.matchAll(/const system = `([\s\S]*?)`;/g)];
      expect(prompts.length).toBeGreaterThan(0);
      for (const [, prompt] of prompts) for (const field of fields) expect(prompt).not.toContain(field);
      for (const field of fields) expect(src).toContain(field);
    }
  });
  it("does not log recipient or unfiltered email provider errors", () => {
    const source = readFileSync("src/lib/reminder-alerts.server.ts", "utf8");
    expect(source).not.toContain("email: digest.email");
    expect(source).toContain('failure: "email_provider_error"');
    expect(source).toContain('failure: "email_send_failed"');
  });
});
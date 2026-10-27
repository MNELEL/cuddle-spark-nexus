import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/claude-tools.server", () => ({ runClaude: mocks.run, parseClaudeJson: JSON.parse }));
import { adviseTeacher } from "@/lib/claude-tools.functions";

const plan = { summary: "בירור", steps: Array.from({ length: 3 }, () => ({ title: "שיחה", action: "בירור אישי", success: "שיתוף פעולה" })) };
const invoke = (userId: string) => (adviseTeacher as unknown as (args: unknown) => Promise<unknown>)({
  data: { dilemma: "כיצד לשפר השתתפות בשיעור?" }, context: { supabase: {}, userId },
});

describe("Claude requests recover after temporary access failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    // No select method: historic block logs must never be queried.
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.run.mockResolvedValue(JSON.stringify(plan));
  });

  for (const status of [402, 403]) {
    it(`a ${status} failure does not block the same or another teacher's next request`, async () => {
      mocks.run.mockRejectedValueOnce(Object.assign(new Error("temporary failure"), { status }));
      await expect(invoke("teacher-a")).rejects.toMatchObject({ statusCode: status });
      expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "teacher-a", source: "claude-tools-access-block" }));
      await expect(invoke("teacher-a")).resolves.toEqual(plan);
      await expect(invoke("teacher-b")).resolves.toEqual(plan);
      expect(mocks.run).toHaveBeenCalledTimes(3);
    });
  }

  it("preserves the provider failure and allows retry when diagnostic logging fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.insert.mockRejectedValueOnce(new Error("log unavailable"));
    mocks.run.mockRejectedValueOnce(Object.assign(new Error("temporary failure"), { status: 402 }));
    await expect(invoke("teacher-a")).rejects.toMatchObject({ message: "temporary failure", statusCode: 402 });
    await expect(invoke("teacher-a")).resolves.toEqual(plan);
    consoleSpy.mockRestore();
  });
});
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "behavior_summary",
  title: "סיכום נקודות התנהגות",
  description:
    "Summarize behavior points per student for one class, optionally limited to a date range (YYYY-MM-DD).",
  inputSchema: {
    class_id: z.string().uuid().describe("The class id."),
    from: z.string().optional().describe("Start date, YYYY-MM-DD."),
    to: z.string().optional().describe("End date, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id, from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const [studentsRes, pointsRes] = await Promise.all([
      supabase.from("students").select("id, name").eq("class_id", class_id),
      (() => {
        let q = supabase
          .from("behavior_points")
          .select("student_id, points, category, date")
          .eq("class_id", class_id);
        if (from) q = q.gte("date", from);
        if (to) q = q.lte("date", to);
        return q;
      })(),
    ]);
    const error = studentsRes.error ?? pointsRes.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const names = new Map((studentsRes.data ?? []).map((s) => [s.id, s.name]));
    const totals = new Map<string, { student_id: string; name: string; total: number; entries: number }>();
    for (const row of pointsRes.data ?? []) {
      const key = row.student_id;
      const current =
        totals.get(key) ?? { student_id: key, name: names.get(key) ?? "לא ידוע", total: 0, entries: 0 };
      current.total += row.points ?? 0;
      current.entries += 1;
      totals.set(key, current);
    }
    const summary = [...totals.values()].sort((a, b) => b.total - a.total);
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: { summary },
    };
  },
});
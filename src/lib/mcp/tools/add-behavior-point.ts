import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "add_behavior_point",
  title: "הוספת נקודת התנהגות",
  description: "Record behavior points for one student (positive or negative).",
  inputSchema: {
    class_id: z.string().uuid().describe("The class id."),
    student_id: z.string().uuid().describe("The student id, as returned by list_students."),
    points: z.number().int().describe("Points to record. Negative values subtract."),
    category: z.string().optional().describe("Category label, e.g. התנהגות / לימוד / תפילה."),
    note: z.string().optional().describe("Short free-text note."),
    date: z.string().optional().describe("Date of the entry, YYYY-MM-DD. Defaults to today."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ class_id, student_id, points, category, note, date }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("behavior_points")
      .insert({
        class_id,
        student_id,
        points,
        ...(category ? { category } : {}),
        ...(note ? { note } : {}),
        ...(date ? { date } : {}),
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { entry: data },
    };
  },
});
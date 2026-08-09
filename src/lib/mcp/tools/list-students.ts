import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_students",
  title: "רשימת תלמידים",
  description:
    "List the students of one class the signed-in teacher can access. Returns names and seat position only — no sensitive contact details.",
  inputSchema: {
    class_id: z.string().uuid().describe("The class id, as returned by list_classes."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, first_name, last_name, seat_row, seat_col")
      .eq("class_id", class_id)
      .order("name", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_reminders",
  title: "רשימת תזכורות",
  description: "List reminders for one class, optionally only the open (not completed) ones.",
  inputSchema: {
    class_id: z.string().uuid().describe("The class id."),
    only_open: z.boolean().optional().describe("When true, return only reminders that are not completed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id, only_open }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("reminders")
      .select("id, title, description, due_date, completed, student_id")
      .eq("class_id", class_id)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (only_open) query = query.eq("completed", false);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { reminders: data ?? [] },
    };
  },
});
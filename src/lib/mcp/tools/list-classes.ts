import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_classes",
  title: "רשימת כיתות",
  description: "List the classes the signed-in teacher can access, with status and academic year.",
  inputSchema: {
    status: z
      .enum(["active", "archived", "all"])
      .optional()
      .describe("Filter by class status. Defaults to active."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("classes")
      .select("id, name, status, academic_year, institution_id, created_at")
      .order("created_at", { ascending: false });
    if (status !== "all") query = query.eq("status", status ?? "active");
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { classes: data ?? [] },
    };
  },
});
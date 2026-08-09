import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Up to 20 unread class notifications for the signed-in recipient. */
export const listUnreadClassNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("class_notifications")
      .select("id, class_id, class_name, type, created_at")
      .eq("recipient_id", context.userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת ההתראות נכשלה."); }
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("class_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) { console.error("[DB Error]", error); throw new Error("סימון ההתראה נכשל."); }
    return { ok: true };
  });
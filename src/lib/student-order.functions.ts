import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * שמירת סדר ידני של התלמידים בכיתה.
 * students.sort_order = המקום ברשימה (1 ומעלה). תלמיד בלי ערך (למשל חדש) מופיע אחרי כולם, לפי שם.
 */
export const reorderStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: cls, error: cErr } = await supabase
      .from("classes")
      .select("id, owner_id, status")
      .eq("id", data.classId)
      .maybeSingle();
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("בדיקת ההרשאות נכשלה."); }
    if (!cls || cls.owner_id !== context.userId) throw new Error("הכיתה לא נמצאה");
    if (cls.status === "archived") throw new Error("הכיתה בארכיון, אי אפשר לשנות בה את הסדר");

    const { data: rows, error: sErr } = await supabase.from("students").select("id").eq("class_id", data.classId);
    if (sErr) { console.error("[DB Error]", sErr); throw new Error("בדיקת התלמידים נכשלה."); }
    const known = new Set((rows ?? []).map((r: any) => r.id as string));
    if (new Set(data.orderedIds).size !== data.orderedIds.length || data.orderedIds.some((id) => !known.has(id))) {
      throw new Error("נתונים לא תקינים");
    }

    const results = await Promise.all(
      data.orderedIds.map((id, i) =>
        supabase.from("students").update({ sort_order: i + 1 }).eq("id", id).eq("class_id", data.classId),
      ),
    );
    const failed = results.find((r: any) => r.error);
    if (failed) { console.error("[DB Error]", failed.error); throw new Error("שמירת הסדר נכשלה."); }
    return { ok: true };
  });

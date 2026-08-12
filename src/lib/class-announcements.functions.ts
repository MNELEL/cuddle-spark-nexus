import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const severity = z.enum(["info", "warning", "critical"]);

/** כל ההודעות החשובות של הכיתה + מצב הקריאה/הסגירה של המשתמש הנוכחי. */
export const listClassAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid("מזהה כיתה חסר או שגוי") }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("class_announcements")
      .select("id, class_id, title, body, severity, active, created_at")
      .eq("class_id", data.classId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת ההודעות נכשלה."); }
    const ids = (rows ?? []).map((r) => r.id);
    let states: { announcement_id: string; read_at: string | null; dismissed_at: string | null }[] = [];
    if (ids.length) {
      const res = await context.supabase
        .from("class_announcement_states")
        .select("announcement_id, read_at, dismissed_at")
        .eq("user_id", context.userId)
        .in("announcement_id", ids);
      if (res.error) { console.error("[DB Error]", res.error); throw new Error("טעינת מצב ההודעות נכשלה."); }
      states = res.data ?? [];
    }
    const byId = new Map(states.map((s) => [s.announcement_id, s]));
    return (rows ?? []).map((r) => ({
      ...r,
      read_at: byId.get(r.id)?.read_at ?? null,
      dismissed_at: byId.get(r.id)?.dismissed_at ?? null,
    }));
  });

export const createClassAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid("מזהה כיתה חסר או שגוי"),
      title: z.string().trim().min(1, "יש להזין כותרת להודעה").max(120, "הכותרת ארוכה מדי (עד 120 תווים)"),
      body: z.string().trim().max(2000, "תוכן ההודעה ארוך מדי (עד 2000 תווים)").optional(),
      severity: severity.default("info"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("class_announcements")
      .insert({
        class_id: data.class_id,
        title: data.title,
        body: data.body && data.body.length ? data.body : null,
        severity: data.severity,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת ההודעה נכשלה."); }
    return row;
  });

export const setClassAnnouncementActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("class_announcements")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון ההודעה נכשל."); }
    return { ok: true };
  });

export const deleteClassAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_announcements").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת ההודעה נכשלה."); }
    return { ok: true };
  });

/**
 * סימון נקרא / סגירה / שחזור — המצב נשמר לכל משתמש בנפרד
 * כדי שיתקיים גם בכניסה הבאה לכיתה.
 */
export const setAnnouncementState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      announcement_id: z.string().uuid(),
      action: z.enum(["read", "unread", "dismiss", "restore"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch: { read_at?: string | null; dismissed_at?: string | null } =
      data.action === "read" ? { read_at: now }
      : data.action === "unread" ? { read_at: null }
      : data.action === "dismiss" ? { read_at: now, dismissed_at: now }
      : { dismissed_at: null };

    const { data: existing, error: readErr } = await context.supabase
      .from("class_announcement_states")
      .select("id")
      .eq("announcement_id", data.announcement_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) { console.error("[DB Error]", readErr); throw new Error("עדכון מצב ההודעה נכשל."); }

    if (existing) {
      const { error } = await context.supabase
        .from("class_announcement_states")
        .update(patch)
        .eq("id", existing.id);
      if (error) { console.error("[DB Error]", error); throw new Error("עדכון מצב ההודעה נכשל."); }
    } else {
      const { error } = await context.supabase
        .from("class_announcement_states")
        .insert({ announcement_id: data.announcement_id, user_id: context.userId, ...patch });
      if (error) { console.error("[DB Error]", error); throw new Error("עדכון מצב ההודעה נכשל."); }
    }
    return { ok: true };
  });
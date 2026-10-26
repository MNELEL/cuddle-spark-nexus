import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_STUDENT_DAILY } from "./audit-sources";
import { dailySnapshotDescription } from "./daily-portfolio-snapshot";

/**
 * תיעוד יומי לתלמיד בודד מתוך ה-CRM: נוכחות, ציון ותובנה יומית —
 * הכל ליום העברי הפעיל, בשמירה אחת, עם רישום היסטוריית שינויים.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export type StudentDailyEntry = {
  attendance: { status: string; notes: string } | null;
  grades: { id: string; subject: string; value: number; max_value: number; notes: string }[];
  insights: { id: string; severity: string; title: string; description: string }[];
};

async function ownedStudent(supabase: any, studentId: string, userId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id,class_id,classes!inner(owner_id)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת ההרשאות נכשלה."); }
  if (!data || data.classes?.owner_id !== userId) throw new Error("התלמיד לא נמצא");
  return data.class_id as string;
}

/** טעינת התיעוד היומי הקיים לתלמיד בתאריך. */
export const getStudentDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }): Promise<StudentDailyEntry> => {
    const supabase = context.supabase as any;
    await ownedStudent(supabase, data.studentId, context.userId);

    const [att, grades, insights] = await Promise.all([
      supabase
        .from("attendance")
        .select("status,notes")
        .eq("student_id", data.studentId)
        .eq("date", data.date)
        .maybeSingle(),
      supabase
        .from("grades")
        .select("id,subject,value,max_value,notes")
        .eq("student_id", data.studentId)
        .eq("date", data.date),
      supabase
        .from("orchestrator_insights")
        .select("id,severity,title,description")
        .eq("student_id", data.studentId)
        .eq("insight_type", "manual")
        .eq("insight_date", data.date),
    ]);
    for (const r of [att, grades, insights]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת התיעוד נכשלה."); }
    }

    return {
      attendance: att.data ? { status: att.data.status, notes: att.data.notes ?? "" } : null,
      grades: (grades.data ?? []).map((g: any) => ({
        id: g.id,
        subject: g.subject ?? "",
        value: Number(g.value),
        max_value: Number(g.max_value) || 100,
        notes: g.notes ?? "",
      })),
      insights: (insights.data ?? []).map((i: any) => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        description: i.description ?? "",
      })),
    };
  });

/** שמירת נוכחות + ציון + תובנה יומית לתלמיד בשמירה אחת. */
export const saveStudentDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        date: isoDate,
        status: z.enum(["present", "absent", "late", "excused"]).nullable().optional(),
        attendanceNotes: z.string().max(500).default(""),
        grade: z
          .object({
            subject: z.string().trim().max(60).default(""),
            value: z.number().min(0),
            max_value: z.number().positive().default(100),
          })
          .nullable()
          .optional(),
        insight: z
          .object({
            severity: z.enum(["low", "medium", "high"]).default("low"),
            title: z.string().trim().min(2, "כתוב כותרת לתובנה").max(200),
            description: z.string().trim().max(2000).default(""),
          })
          .nullable()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    const classId = await ownedStudent(supabase, data.studentId, userId);
    const changes: string[] = [];

    if (data.status) {
      const { error } = await supabase.from("attendance").upsert(
        {
          class_id: classId,
          student_id: data.studentId,
          date: data.date,
          status: data.status,
          notes: data.attendanceNotes,
        },
        { onConflict: "student_id,date" },
      );
      if (error) { console.error("[DB Error]", error); throw new Error("שמירת הנוכחות נכשלה."); }
      const statusHe = { present: "נוכח", absent: "חסר", late: "איחר", excused: "חיסור מוצדק" }[data.status];
      changes.push(`נוכחות: ${statusHe}`);
    }

    if (data.grade) {
      const { error } = await supabase.from("grades").insert({
        class_id: classId,
        student_id: data.studentId,
        subject: data.grade.subject,
        value: data.grade.value,
        max_value: data.grade.max_value,
        date: data.date,
        notes: "",
      });
      if (error) { console.error("[DB Error]", error); throw new Error("שמירת הציון נכשלה."); }
      changes.push(`ציון ${data.grade.value}/${data.grade.max_value} ${data.grade.subject}`.trim());
    }

    if (data.insight) {
      const { error } = await supabase.from("orchestrator_insights").insert({
        owner_id: userId,
        class_id: classId,
        student_id: data.studentId,
        insight_type: "manual",
        insight_date: data.date,
        severity: data.insight.severity,
        title: data.insight.title,
        description: data.insight.description,
      });
      if (error) { console.error("[DB Error]", error); throw new Error("שמירת התובנה נכשלה."); }
      changes.push(`תובנה: ${data.insight.title}`);
    }

    if (changes.length === 0) return { ok: true, changes: 0 };

    // הכנסה אוטומטית לתיק התלמיד — מאושרת מיד, בלי שלב "ממתין לאישור".
    const { data: stu } = await supabase
      .from("students")
      .select("person_key")
      .eq("id", data.studentId)
      .maybeSingle();
    if (stu?.person_key) {
      const now = new Date().toISOString();
      const kind = data.insight?.severity === "high" ? "difficulty" : data.grade ? "assessment" : "note";
      const { error: pErr } = await supabase.from("student_portfolio_items").insert({
        user_id: userId,
        person_key: stu.person_key,
        student_id: data.studentId,
        class_id: classId,
        kind,
        title: data.insight?.title ?? "תיעוד יומי",
        description: [...changes, data.insight?.description, data.attendanceNotes].filter(Boolean).join(" · "),
        item_date: data.date,
        approved_at: now,
      });
      if (pErr) console.error("[DB Error] portfolio auto-insert", pErr);
    }

    await supabase.from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_STUDENT_DAILY,
      level: "info",
      message: `תיעוד יומי (${data.date}): ${changes.join(" · ")}`,
      context: { student_id: data.studentId, class_id: classId, date: data.date },
    });

    return { ok: true, changes: changes.length };
  });

/** משיכת הנתונים שכבר נשמרו היום לתיק — ללא שינוי ציונים או נוכחות. */
export const captureTodayToPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const classId = await ownedStudent(db, data.studentId, context.userId);
    const now = new Date().toISOString();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    const [student, att, grades, insights] = await Promise.all([
      db.from("students").select("person_key").eq("id", data.studentId).single(),
      db.from("attendance").select("status,notes").eq("student_id", data.studentId).eq("date", date).maybeSingle(),
      db.from("grades").select("id,subject,value,max_value,notes").eq("student_id", data.studentId).eq("date", date),
      db.from("orchestrator_insights").select("id,severity,title,description").eq("student_id", data.studentId).eq("insight_date", date),
    ]);
    if ([student, att, grades, insights].some((r) => r.error) || !student.data) throw new Error("טעינת התיעוד לתיק נכשלה.");
    if (!att.data && !grades.data?.length && !insights.data?.length) throw new Error("לא נשמר תיעוד להיום. שמור נוכחות, ציון או סיכום תחילה.");
    const entry: StudentDailyEntry = {
      attendance: att.data ? { status: att.data.status, notes: att.data.notes ?? "" } : null,
      grades: (grades.data ?? []).map((g) => ({ id: g.id, subject: g.subject ?? "", value: Number(g.value), max_value: Number(g.max_value), notes: g.notes ?? "" })),
      insights: (insights.data ?? []).map((i) => ({ id: i.id, severity: i.severity, title: i.title, description: i.description ?? "" })),
    };
    const { data: item, error } = await db.from("student_portfolio_items").insert({ user_id: context.userId, person_key: student.data.person_key, student_id: data.studentId, class_id: classId,
      item_date: date, approved_at: now, kind: entry.grades.length ? "assessment" : "note", title: "תיעוד היום · משיכה אוטומטית", description: dailySnapshotDescription(entry, date, now),
    }).select("id,approved_at").single();
    if (error || !item) throw new Error("התיעוד לא נכנס לתיק. נסה שוב.");
    return item;
  });

/** היסטוריית שינויים של התיעוד היומי לתלמיד. */
export const listStudentDailyHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedStudent(supabase, data.studentId, context.userId);
    const { data: rows, error } = await supabase
      .from("app_logs")
      .select("id,message,created_at,context")
      .eq("source", AUDIT_SOURCE_STUDENT_DAILY)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת ההיסטוריה נכשלה."); }
    return ((rows ?? []) as any[])
      .filter((r) => r.context?.student_id === data.studentId)
      .map((r) => ({ id: r.id as string, message: r.message as string, created_at: r.created_at as string }));
  });

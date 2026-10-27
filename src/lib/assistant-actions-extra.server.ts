import { z } from "zod";
import {
  approvePacingPlanCore, computePacingPlanCore, loadPlans, relabelSubject,
} from "@/lib/pacing-plan.functions";
import { weekStartIso } from "@/lib/schedule-view";

/**
 * פעולות כתיבה נוספות של העוזר, שמבוצעות רק אחרי אישור המלמד.
 * כל פעולה בודקת את הקלט בעצמה, וכל כתיבה עוברת דרך הרשאות הבעלים של הכיתה.
 */
export const EXTRA_KINDS = [
  "set_weekly_honor",
  "save_pacing_subject",
  "compute_pacing",
  "approve_pacing",
  "edit_pacing_week",
  "set_day_column",
  "swap_seats",
  "import_timetable",
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];
export const isExtraKind = (k: string): k is ExtraKind => (EXTRA_KINDS as readonly string[]).includes(k);

type Ctx = { supabase: any; userId: string; classId: string; today: string };
const uuid = z.string().uuid();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const asBool = (v: unknown) => v === true || String(v).toLowerCase() === "true" || String(v) === "1";

const KNOWN_CRITERIA: Record<string, string> = {
  "מוכנות": "readiness", "הקשבה": "listening", "התנהגות": "behavior", "עבודות": "work_done", "תפילה": "prayer",
};
function criterionKey(label: string): string {
  if (KNOWN_CRITERIA[label]) return KNOWN_CRITERIA[label]!;
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `c_${h.toString(36)}`;
}

async function studentInClass(ctx: Ctx, id: unknown, what = "התלמיד"): Promise<string> {
  const r = uuid.safeParse(String(id ?? ""));
  if (!r.success) throw new Error(`מזהה ${what} לא תקין`);
  const { data, error } = await ctx.supabase.from("students").select("id").eq("id", r.data).eq("class_id", ctx.classId).maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת התלמיד נכשלה"); }
  if (!data) throw new Error(`${what} אינו שייך לכיתה זו`);
  return r.data;
}

export async function executeExtraAction(ctx: Ctx, kind: ExtraKind, p: Record<string, unknown>): Promise<{ ok: true; message: string }> {
  const { supabase, classId } = ctx;

  if (kind === "set_weekly_honor") {
    const sid = await studentInClass(ctx, p.student_id);
    const k = String(p.kind ?? "");
    if (k !== "excellent" && k !== "investing") throw new Error("סוג הכיבוד חייב להיות מצטיין או משקיע");
    const week = weekStartIso(dateRe.test(String(p.week_start ?? "")) ? String(p.week_start) : ctx.today);
    const { error } = await supabase.from("weekly_honors").upsert(
      { class_id: classId, student_id: sid, week_start: week, kind: k, note: String(p.note ?? "").slice(0, 300) || null },
      { onConflict: "student_id,week_start,kind" },
    );
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הכיבוד נכשלה"); }
    return { ok: true, message: "נשמר" };
  }

  if (kind === "save_pacing_subject") {
    const subject = String(p.subject ?? "").trim().slice(0, 60);
    if (!subject) throw new Error("חסר שם מקצוע");
    const mode = ["amount", "topics", "both"].includes(String(p.mode)) ? String(p.mode) : "amount";
    const total = p.total_amount == null || p.total_amount === "" ? null : Number(p.total_amount);
    if (total != null && (!Number.isFinite(total) || total < 0)) throw new Error("כמות לא תקינה");
    const topics = String(p.topics ?? "")
      .split(/[;\n|]+/).map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [title, n] = s.split(/[:：]/); return { title: (title ?? "").trim().slice(0, 80), lessons: Math.max(1, Math.round(Number(n) || 5)) }; })
      .filter((t) => t.title).slice(0, 80);
    if (mode !== "topics" && !(total && total > 0)) throw new Error("חסרה כמות כוללת");
    if (mode !== "amount" && topics.length === 0) throw new Error("חסרים נושאים");
    const { error } = await supabase.from("pacing_subject_plans").upsert({
      class_id: classId, subject, mode, total_amount: total,
      unit_label: String(p.unit_label ?? "").trim().slice(0, 20) || "יחידות",
      start_number: Number.isFinite(Number(p.start_number)) ? Number(p.start_number) : 1,
      topics, updated_at: new Date().toISOString(),
    }, { onConflict: "class_id,subject" });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת ההגדרה נכשלה"); }
    return { ok: true, message: `נשמרה הגדרה ל${subject}. כדי לראות טבלה, לחשב תוכנית` };
  }

  if (kind === "compute_pacing") {
    const r = await computePacingPlanCore(supabase, classId, ctx.today);
    const done = r.summary.filter((s) => !s.skipped).length;
    const skipped = r.summary.filter((s) => s.skipped).map((s) => `${s.subject}: ${s.skipped}`);
    return { ok: true, message: `חושבה תוכנית ל-${done} מקצועות${skipped.length ? `. דולגו: ${skipped.join(", ")}` : ""}` };
  }

  if (kind === "approve_pacing") {
    const r = await approvePacingPlanCore(supabase, classId, ctx.today);
    return { ok: true, message: `אושר. עודכנו היעדים ב-${r.lessonsUpdated} שיעורים` };
  }

  if (kind === "edit_pacing_week") {
    const subject = String(p.subject ?? "").trim();
    const amount = Math.round(Number(p.amount));
    if (!subject || !Number.isFinite(amount) || amount < 0) throw new Error("חסר מקצוע או כמות תקינה");
    const week = weekStartIso(dateRe.test(String(p.week_start ?? "")) ? String(p.week_start) : ctx.today);
    const { data: row, error: gErr } = await supabase.from("pacing_plan_weeks").select("id").eq("class_id", classId).eq("subject", subject).eq("week_start", week).maybeSingle();
    if (gErr || !row) throw new Error("לא נמצא שבוע בתוכנית. חשבו קודם תוכנית");
    const { error } = await supabase.from("pacing_plan_weeks").update({ amount, edited: true, status: "draft", updated_at: new Date().toISOString() }).eq("id", row.id).eq("class_id", classId);
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון השבוע נכשל"); }
    const plan = (await loadPlans(supabase, classId)).find((x) => x.subject === subject);
    if (plan) await relabelSubject(supabase, classId, subject, plan.start_number);
    return { ok: true, message: "השבוע עודכן והטווחים חושבו מחדש" };
  }

  if (kind === "set_day_column") {
    const subject = String(p.subject ?? "").trim().slice(0, 60);
    if (!subject) throw new Error("חסר שם מקצוע");
    const { data: slot, error: gErr } = await supabase.from("class_day_slots").select("id,label,order_index").eq("class_id", classId).eq("subject", subject).maybeSingle();
    if (gErr) { console.error("[DB Error]", gErr); throw new Error("טעינת העמודה נכשלה"); }
    const patch: Record<string, unknown> = {};
    if (p.rated !== undefined && p.rated !== null && p.rated !== "") patch.rated = asBool(p.rated);
    if (typeof p.label === "string" && p.label.trim()) patch.label = p.label.trim().slice(0, 30);
    if (typeof p.criteria === "string") {
      const labels = p.criteria.split(/[,،;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
      patch.criteria = Array.from(new Map(labels.map((l) => [criterionKey(l), { key: criterionKey(l), label: l.slice(0, 24) }])).values());
    }
    if (slot) {
      if (Object.keys(patch).length === 0) throw new Error("לא צוין מה לשנות");
      const { error } = await supabase.from("class_day_slots").update({ ...patch, active: true }).eq("id", slot.id).eq("class_id", classId);
      if (error) { console.error("[DB Error]", error); throw new Error("עדכון העמודה נכשל"); }
    } else {
      const { data: all } = await supabase.from("class_day_slots").select("order_index").eq("class_id", classId);
      const base = Math.max(100, ...((all ?? []) as { order_index: number }[]).map((r) => r.order_index)) + 1;
      const { error } = await supabase.from("class_day_slots").insert({
        class_id: classId, subject, label: (patch.label as string) ?? subject, rated: patch.rated ?? true,
        criteria: patch.criteria ?? [], order_index: base,
      });
      if (error) { console.error("[DB Error]", error); throw new Error("יצירת העמודה נכשלה"); }
    }
    return { ok: true, message: `העמודה של ${subject} עודכנה` };
  }

  if (kind === "swap_seats") {
    const a = await studentInClass(ctx, p.student_a, "התלמיד הראשון");
    const b = await studentInClass(ctx, p.student_b, "התלמיד השני");
    if (a === b) throw new Error("צריך שני תלמידים שונים");
    const { data, error } = await supabase.from("students").select("id,seat_row,seat_col").in("id", [a, b]);
    if (error || (data ?? []).length !== 2) { console.error("[DB Error]", error); throw new Error("טעינת המושבים נכשלה"); }
    const A = (data as any[]).find((x) => x.id === a)!;
    const B = (data as any[]).find((x) => x.id === b)!;
    const r1 = await supabase.from("students").update({ seat_row: B.seat_row, seat_col: B.seat_col }).eq("id", a).eq("class_id", classId);
    const r2 = await supabase.from("students").update({ seat_row: A.seat_row, seat_col: A.seat_col }).eq("id", b).eq("class_id", classId);
    if (r1.error || r2.error) { console.error("[DB Error]", r1.error ?? r2.error); throw new Error("החלפת המושבים נכשלה"); }
    return { ok: true, message: "המושבים הוחלפו" };
  }

  if (kind === "import_timetable") {
    let parsed: unknown;
    try { parsed = JSON.parse(String(p.slots ?? "[]")); } catch { throw new Error("רשימת השיעורים אינה תקינה"); }
    const schema = z.array(z.object({
      day: z.enum(["sun", "mon", "tue", "wed", "thu", "fri"]),
      hour: z.number().int().min(6).max(22),
      minute: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45)]).default(0),
      subject: z.string().trim().min(1).max(100),
    })).min(1).max(80);
    const r = schema.safeParse(parsed);
    if (!r.success) throw new Error("רשימת השיעורים אינה תקינה");
    const replace = asBool(p.replace);
    if (replace) {
      const { error } = await supabase.from("schedule_template_slots").delete().eq("class_id", classId);
      if (error) { console.error("[DB Error]", error); throw new Error("ניקוי המערכת הקבועה נכשל"); }
    }
    const { data: existing } = await supabase.from("schedule_template_slots").select("day_key,hour,minute").eq("class_id", classId);
    const taken = new Set(((existing ?? []) as any[]).map((e) => `${e.day_key}|${e.hour}|${e.minute ?? 0}`));
    const rows = r.data
      .filter((s) => !taken.has(`${s.day}|${s.hour}|${s.minute}`))
      .map((s) => ({ class_id: classId, day_key: s.day, hour: s.hour, minute: s.minute, duration: 1, title: s.subject, subject: s.subject }));
    if (rows.length) {
      const { error } = await supabase.from("schedule_template_slots").insert(rows);
      if (error) { console.error("[DB Error]", error); throw new Error("שמירת המערכת הקבועה נכשלה"); }
    }
    return { ok: true, message: `נוספו ${rows.length} שיעורים למערכת הקבועה${rows.length < r.data.length ? ` (${r.data.length - rows.length} כבר היו)` : ""}. להחלה על השבועות: במערכת השבועית, החל את המערכת` };
  }

  throw new Error("פעולה לא מוכרת");
}

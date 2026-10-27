import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { closureFor, lessonDateIso, lessonName, weekStartIso } from "@/lib/schedule-view";
import { planSubject, rangeText, relabel, respread, splitWeek } from "@/lib/pacing-math";

/**
 * תכנון קצב שנתי: כמה צריך להספיק בכל שבוע ובכל שיעור, לפי השיעורים שנשארו במערכת
 * (אחרי חופשות, חגים וכללים קבועים, שכבר משתקפים ב-weekly_lessons), עם רזרבה לחזרה.
 * התוכנית נשמרת כטיוטה, אפשר לערוך אותה ידנית, ובאישור היא נכתבת להערות השיעורים בשבוע.
 */
export type PacingMode = "amount" | "topics" | "both";
export type PacingTopic = { title: string; lessons: number };
export type PacingSubjectPlan = {
  subject: string;
  mode: PacingMode;
  total_amount: number | null;
  unit_label: string;
  start_number: number;
  topics: PacingTopic[];
};
export type PacingWeekRow = {
  id: string;
  subject: string;
  week_start: string;
  lessons: number;
  amount: number;
  from_label: string | null;
  to_label: string | null;
  topics: string | null;
  edited: boolean;
  status: "draft" | "approved";
};
export type PacingOverview = {
  plans: PacingSubjectPlan[];
  weeks: PacingWeekRow[];
  /** מקצועות במערכת מהיום והלאה, עם מספר השיעורים שנשארו */
  subjects: { name: string; remainingLessons: number }[];
  bufferPercent: number;
  fromWeek: string;
};

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const DEFAULT_BUFFER = 10;

async function ownedClass(supabase: any, classId: string, userId: string) {
  const { data, error } = await supabase.from("classes").select("id,owner_id,status").eq("id", classId).maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת ההרשאות נכשלה."); }
  if (!data || data.owner_id !== userId) throw new Error("הכיתה לא נמצאה");
  if (data.status === "archived") throw new Error("הכיתה בארכיון");
}

type FutureLesson = { id: string; name: string; date: string; weekStart: string; hour: number; minute: number };

/** כל שיעורי המערכת מהיום והלאה, בלי ימים ללא לימודים, בסדר כרונולוגי. */
export async function loadFutureLessons(supabase: any, classId: string, today: string): Promise<FutureLesson[]> {
  const fromWeek = weekStartIso(today);
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("weekly_lessons")
      .select("id,week_start,day_key,hour,minute,subject,title")
      .eq("class_id", classId)
      .gte("week_start", fromWeek)
      .range(from, from + 999);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת המערכת נכשלה."); }
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const { data: ov, error: oErr } = await supabase
    .from("academic_calendar_overrides")
    .select("start_date,end_date,type,label")
    .eq("class_id", classId)
    .gte("end_date", today);
  if (oErr) { console.error("[DB Error]", oErr); throw new Error("טעינת לוח השנה נכשלה."); }
  const closures = (ov ?? []) as any[];
  return rows
    .map((r) => ({
      id: r.id as string,
      name: lessonName({ subject: r.subject ?? null, title: r.title ?? "" }),
      date: lessonDateIso(r.week_start as string, r.day_key as string),
      weekStart: r.week_start as string,
      hour: r.hour as number,
      minute: (r.minute ?? 0) as number,
    }))
    .filter((l) => l.name && l.date >= today && !closureFor(l.date, closures))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.minute - b.minute);
}

export async function loadPlans(supabase: any, classId: string): Promise<PacingSubjectPlan[]> {
  const { data, error } = await supabase
    .from("pacing_subject_plans")
    .select("subject,mode,total_amount,unit_label,start_number,topics")
    .eq("class_id", classId)
    .order("subject", { ascending: true });
  if (error) { console.error("[DB Error]", error); throw new Error("טעינת התוכנית נכשלה."); }
  return ((data ?? []) as any[]).map((r) => ({
    subject: r.subject as string,
    mode: r.mode as PacingMode,
    total_amount: r.total_amount == null ? null : Number(r.total_amount),
    unit_label: (r.unit_label ?? "יחידות") as string,
    start_number: Number(r.start_number ?? 1),
    topics: Array.isArray(r.topics) ? (r.topics as PacingTopic[]) : [],
  }));
}

async function loadBuffer(supabase: any, classId: string): Promise<number> {
  const { data } = await supabase.from("class_pacing_settings").select("buffer_percent").eq("class_id", classId).maybeSingle();
  const n = Number(data?.buffer_percent);
  return Number.isFinite(n) ? n : DEFAULT_BUFFER;
}

export async function loadWeeks(supabase: any, classId: string, fromWeek?: string): Promise<PacingWeekRow[]> {
  let q = supabase
    .from("pacing_plan_weeks")
    .select("id,subject,week_start,lessons,amount,from_label,to_label,topics,edited,status")
    .eq("class_id", classId);
  if (fromWeek) q = q.gte("week_start", fromWeek);
  const { data, error } = await q.order("week_start", { ascending: true });
  if (error) { console.error("[DB Error]", error); throw new Error("טעינת השבועות נכשלה."); }
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    subject: r.subject as string,
    week_start: r.week_start as string,
    lessons: r.lessons as number,
    amount: Number(r.amount),
    from_label: (r.from_label ?? null) as string | null,
    to_label: (r.to_label ?? null) as string | null,
    topics: (r.topics ?? null) as string | null,
    edited: Boolean(r.edited),
    status: r.status as "draft" | "approved",
  }));
}

export const getPacingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, today: dateStr }).parse(d))
  .handler(async ({ data, context }): Promise<PacingOverview> => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const fromWeek = weekStartIso(data.today);
    const [lessons, plans, weeks, bufferPercent] = await Promise.all([
      loadFutureLessons(supabase, data.classId, data.today),
      loadPlans(supabase, data.classId),
      loadWeeks(supabase, data.classId, fromWeek),
      loadBuffer(supabase, data.classId),
    ]);
    const count = new Map<string, number>();
    for (const l of lessons) count.set(l.name, (count.get(l.name) ?? 0) + 1);
    const subjects = [...count.entries()]
      .map(([name, remainingLessons]) => ({ name, remainingLessons }))
      .sort((a, b) => b.remainingLessons - a.remainingLessons || a.name.localeCompare(b.name, "he"));
    return { plans, weeks, subjects, bufferPercent, fromWeek };
  });

const topicSchema = z.object({ title: z.string().trim().min(1).max(80), lessons: z.number().int().min(1).max(500) });

export const savePacingSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        subject: z.string().trim().min(1).max(60),
        mode: z.enum(["amount", "topics", "both"]),
        totalAmount: z.number().min(0).max(100000).nullable(),
        unitLabel: z.string().trim().min(1).max(20),
        startNumber: z.number().min(0).max(100000),
        topics: z.array(topicSchema).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { error } = await supabase.from("pacing_subject_plans").upsert(
      {
        class_id: data.classId,
        subject: data.subject,
        mode: data.mode,
        total_amount: data.totalAmount,
        unit_label: data.unitLabel,
        start_number: data.startNumber,
        topics: data.topics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_id,subject" },
    );
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת התוכנית נכשלה."); }
    return { ok: true };
  });

export const deletePacingSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, subject: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const [a, b] = await Promise.all([
      supabase.from("pacing_plan_weeks").delete().eq("class_id", data.classId).eq("subject", data.subject),
      supabase.from("pacing_subject_plans").delete().eq("class_id", data.classId).eq("subject", data.subject),
    ]);
    if (a.error || b.error) { console.error("[DB Error]", a.error ?? b.error); throw new Error("מחיקת התוכנית נכשלה."); }
    return { ok: true };
  });

export const savePacingBuffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, bufferPercent: z.number().min(0).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { error } = await supabase
      .from("class_pacing_settings")
      .upsert({ class_id: data.classId, buffer_percent: data.bufferPercent, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הרזרבה נכשלה."); }
    return { ok: true };
  });

/** מחשב טיוטת תוכנית לכל המקצועות שהוגדרה להם כמות או נושאים. מחליף טיוטות קודמות מהשבוע הנוכחי והלאה. */
export async function computePacingPlanCore(supabase: any, classId: string, today: string) {
    const fromWeek = weekStartIso(today);
    const [lessons, plans, buffer] = await Promise.all([
      loadFutureLessons(supabase, classId, today),
      loadPlans(supabase, classId),
      loadBuffer(supabase, classId),
    ]);
    if (plans.length === 0) throw new Error("הגדירו קודם מה צריך להספיק לפחות במקצוע אחד.");

    const summary: { subject: string; weeks: number; planned: number; target: number | null; skipped?: string }[] = [];
    for (const plan of plans) {
      const ls = lessons.filter((l) => l.name === plan.subject);
      const needsAmount = plan.mode !== "topics";
      const needsTopics = plan.mode !== "amount";
      if (ls.length === 0) { summary.push({ subject: plan.subject, weeks: 0, planned: 0, target: plan.total_amount, skipped: "אין שיעורים במערכת" }); continue; }
      if (needsAmount && !(plan.total_amount && plan.total_amount > 0)) { summary.push({ subject: plan.subject, weeks: 0, planned: 0, target: plan.total_amount, skipped: "חסרה כמות כוללת" }); continue; }
      if (needsTopics && plan.topics.length === 0) { summary.push({ subject: plan.subject, weeks: 0, planned: 0, target: plan.total_amount, skipped: "חסרים נושאים" }); continue; }

      const res = planSubject(
        ls.map((l) => ({ date: l.date, weekStart: l.weekStart })),
        { mode: plan.mode, totalAmount: plan.total_amount, startNumber: plan.start_number, topics: plan.topics },
        buffer,
      );
      const { error: delErr } = await supabase
        .from("pacing_plan_weeks").delete().eq("class_id", classId).eq("subject", plan.subject).gte("week_start", fromWeek);
      if (delErr) { console.error("[DB Error]", delErr); throw new Error("ניקוי טיוטה קודמת נכשל."); }
      const { error: insErr } = await supabase.from("pacing_plan_weeks").insert(
        res.weeks.map((w) => ({
          class_id: classId,
          subject: plan.subject,
          week_start: w.weekStart,
          lessons: w.lessons,
          amount: w.amount,
          from_label: w.from == null ? null : String(w.from),
          to_label: w.to == null ? null : String(w.to),
          topics: w.topics,
          edited: false,
          status: "draft",
        })),
      );
      if (insErr) { console.error("[DB Error]", insErr); throw new Error("שמירת התוכנית נכשלה."); }
      summary.push({ subject: plan.subject, weeks: res.weeks.length, planned: res.weeks.reduce((n, w) => n + w.amount, 0), target: plan.total_amount });
    }
    return { summary, bufferPercent: buffer };
}

export const computePacingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, today: dateStr }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    return computePacingPlanCore(supabase, data.classId, data.today);
  });

export async function relabelSubject(supabase: any, classId: string, subject: string, startNumber: number) {
  const rows = (await loadWeeks(supabase, classId)).filter((r) => r.subject === subject);
  const labels = relabel(rows.map((r) => r.amount), startNumber);
  const results = await Promise.all(
    rows.map((r, i) =>
      supabase.from("pacing_plan_weeks").update({
        from_label: labels[i]!.from == null ? null : String(labels[i]!.from),
        to_label: labels[i]!.to == null ? null : String(labels[i]!.to),
        updated_at: new Date().toISOString(),
      }).eq("id", r.id).eq("class_id", classId),
    ),
  );
  const failed = results.find((r: any) => r.error);
  if (failed) { console.error("[DB Error]", failed.error); throw new Error("עדכון הטווחים נכשל."); }
}

/** עריכה ידנית של כמות בשבוע אחד. הטווחים של כל המקצוע מחושבים מחדש. */
export const updatePacingWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, id: uuid, amount: z.number().int().min(0).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { data: row, error: gErr } = await supabase
      .from("pacing_plan_weeks").select("subject").eq("id", data.id).eq("class_id", data.classId).maybeSingle();
    if (gErr || !row) { console.error("[DB Error]", gErr); throw new Error("השבוע לא נמצא."); }
    const { error } = await supabase
      .from("pacing_plan_weeks")
      .update({ amount: data.amount, edited: true, status: "draft", updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("class_id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת השבוע נכשלה."); }
    const plans = await loadPlans(supabase, data.classId);
    const plan = plans.find((p) => p.subject === row.subject);
    if (plan) await relabelSubject(supabase, data.classId, plan.subject, plan.start_number);
    return { ok: true };
  });

/** מחלק מחדש את מה שנשאר מהכמות הכוללת על השבועות שלא נערכו ידנית. */
export const respreadPacing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, subject: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const plans = await loadPlans(supabase, data.classId);
    const plan = plans.find((p) => p.subject === data.subject);
    if (!plan || !(plan.total_amount && plan.total_amount > 0)) throw new Error("לא הוגדרה כמות כוללת למקצוע");
    const rows = (await loadWeeks(supabase, data.classId)).filter((r) => r.subject === data.subject);
    const amounts = respread(rows, plan.total_amount);
    const results = await Promise.all(
      rows.map((r, i) =>
        r.edited
          ? Promise.resolve({ error: null })
          : supabase.from("pacing_plan_weeks").update({ amount: amounts[i], status: "draft", updated_at: new Date().toISOString() }).eq("id", r.id).eq("class_id", data.classId),
      ),
    );
    const failed = results.find((r: any) => r.error);
    if (failed) { console.error("[DB Error]", failed.error); throw new Error("החלוקה מחדש נכשלה."); }
    await relabelSubject(supabase, data.classId, plan.subject, plan.start_number);
    return { ok: true };
  });

/**
 * אישור התוכנית: הטיוטות הופכות למאושרות, והיעד של כל שיעור נכתב להערות השיעור בשבועות הקרובים ("יעד: ...").
 * הערה שכתב המלמד בעצמו לא נדרסת.
 */
export async function approvePacingPlanCore(supabase: any, classId: string, today: string) {
    const fromWeek = weekStartIso(today);
    const [plans, weeks, lessons] = await Promise.all([
      loadPlans(supabase, classId),
      loadWeeks(supabase, classId, fromWeek),
      loadFutureLessons(supabase, classId, today),
    ]);
    if (weeks.length === 0) throw new Error("אין תוכנית לאשר. חשבו קודם תוכנית.");

    const noteById = new Map<string, string>();
    for (const plan of plans) {
      const rows = weeks.filter((w) => w.subject === plan.subject);
      let cum = 0;
      for (const w of rows) {
        const wl = lessons.filter((l) => l.name === plan.subject && l.weekStart === w.week_start);
        const parts = splitWeek(w.amount, wl.length);
        const weekFrom = plan.start_number + cum;
        let used = 0;
        wl.forEach((l, i) => {
          const part = parts[i] ?? 0;
          const bits: string[] = [];
          if (plan.mode !== "topics" && part > 0) bits.push(rangeText(plan.unit_label, weekFrom + used, weekFrom + used + part - 1));
          if (plan.mode !== "amount" && w.topics) bits.push(w.topics);
          if (bits.length === 0) bits.push(w.topics ?? "חזרה");
          noteById.set(l.id, `יעד: ${bits.join(" · ")}`);
          used += part;
        });
        cum += w.amount;
      }
    }

    const ids = [...noteById.keys()];
    let applied = 0;
    for (let i = 0; i < ids.length; i += 300) {
      const chunk = ids.slice(i, i + 300);
      const { data: full, error: fErr } = await supabase.from("weekly_lessons").select("*").in("id", chunk);
      if (fErr) { console.error("[DB Error]", fErr); throw new Error("קריאת השיעורים נכשלה."); }
      const rows = ((full ?? []) as any[])
        .filter((r) => !r.notes || String(r.notes).startsWith("יעד:"))
        .map((r) => ({ ...r, notes: noteById.get(r.id as string)! }));
      if (!rows.length) continue;
      const { error: uErr } = await supabase
        .from("weekly_lessons").upsert(rows, { onConflict: "class_id,week_start,day_key,hour,minute" });
      if (uErr) { console.error("[DB Error]", uErr); throw new Error("כתיבת היעדים לשיעורים נכשלה."); }
      applied += rows.length;
    }

    const { error } = await supabase
      .from("pacing_plan_weeks").update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("class_id", classId).gte("week_start", fromWeek);
    if (error) { console.error("[DB Error]", error); throw new Error("סימון התוכנית כמאושרת נכשל."); }
    return { ok: true, weeks: weeks.length, lessonsUpdated: applied };
}

export const approvePacingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, today: dateStr }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    return approvePacingPlanCore(supabase, data.classId, data.today);
  });

/** מה מתוכנן לשבוע אחד, לכל המקצועות. משמש את העלון והגיליון השבועי. */
export const getWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, weekStart: dateStr }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const [plans, { data: rows, error }] = await Promise.all([
      loadPlans(supabase, data.classId),
      supabase
        .from("pacing_plan_weeks")
        .select("id,subject,week_start,lessons,amount,from_label,to_label,topics,edited,status")
        .eq("class_id", data.classId)
        .eq("week_start", weekStartIso(data.weekStart)),
    ]);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת תוכנית השבוע נכשלה."); }
    const unit = new Map(plans.map((p) => [p.subject, p]));
    return ((rows ?? []) as any[]).map((r) => {
      const p = unit.get(r.subject as string);
      const range = p && p.mode !== "topics" && r.from_label != null && r.to_label != null
        ? rangeText(p.unit_label, Number(r.from_label), Number(r.to_label))
        : "";
      return {
        subject: r.subject as string,
        lessons: r.lessons as number,
        range,
        topics: (r.topics ?? "") as string,
        status: r.status as "draft" | "approved",
      };
    });
  });

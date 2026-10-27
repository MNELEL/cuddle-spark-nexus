import { HDate } from "@hebcal/core";
import { addDaysIso, dayKeyOfIso, hhmm, isoDate, lessonDateIso, lessonName, weekStartIso } from "@/lib/schedule-view";

/**
 * כלי קריאה של סוכן העוזר האישי. כל כלי שולף נתונים מהכיתה ומחזיר תוצאה קצרה למודל.
 * כתובות מלאות ותאריכי לידה לא נשלחים למודל: רק רחוב, ותאריך עברי מחושב.
 */
export type ToolCtx = { supabase: any; userId: string; classId: string; today: string };
export type ReadTool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: any, ctx: ToolCtx) => Promise<unknown>;
};

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: Object.keys(properties).length ? properties : { _unused: { type: "string", description: "לא בשימוש" } },
  ...(required.length ? { required } : {}),
});

async function students(ctx: ToolCtx, cols = "id,name,address,birth_date") {
  const { data, error } = await ctx.supabase.from("students").select(cols).eq("class_id", ctx.classId);
  if (error) { console.error("[DB Error]", error); throw new Error("טעינת התלמידים נכשלה"); }
  return (data ?? []) as any[];
}

const norm = (s: string) => s.replace(/["'׳״`]/g, "").replace(/\s+/g, " ").trim();
/** רחוב בלי מספר בית, מילות "רחוב" ופרטי דירה. */
export function streetOf(address: string | null | undefined): string {
  if (!address) return "";
  return norm(String(address).replace(/[0-9\/\\\-,.]+/g, " ").replace(/^(רח|רחוב)\s+/, ""));
}

/* ----- ימי הולדת עבריים ----- */
function birthdayInHebrewYear(birth: Date, hy: number): Date | null {
  const hd = new HDate(birth);
  let m = hd.getMonth();
  const day = hd.getDate();
  const targetLeap = HDate.isLeapYear(hy);
  if (m === 13 && !targetLeap) m = 12;                                   // אדר ב׳ בשנה פשוטה: חוגגים באדר
  else if (m === 12 && !HDate.isLeapYear(hd.getFullYear()) && targetLeap) m = 13; // נולד באדר בשנה פשוטה: חוגגים באדר ב׳
  try { return new HDate(day, m, hy).greg(); } catch { return null; }
}
const hebrewDayMonth = (d: Date) => new HDate(d).render("he", false).replace(/[\u0591-\u05C7]/g, "");
const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);
const startOfDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, m! - 1, d!); };

export const READ_TOOLS: ReadTool[] = [
  {
    name: "find_students",
    label: "רשימת התלמידים",
    description: "מחפש תלמידים בכיתה לפי רחוב מגורים ו/או חלק משם. מחזיר שם ורחוב בלבד (בלי מספר בית).",
    parameters: obj({
      street: { type: "string", description: "שם הרחוב, למשל ארלוזרוב" },
      name: { type: "string", description: "חלק משם התלמיד" },
    }),
    run: async (a, ctx) => {
      const rows = await students(ctx);
      const st = a?.street ? norm(String(a.street)).replace(/^(רח|רחוב)\s+/, "") : "";
      const nm = a?.name ? norm(String(a.name)) : "";
      const hit = rows.filter((r) => (!st || streetOf(r.address).includes(st)) && (!nm || norm(r.name).includes(nm)));
      return {
        total_students: rows.length,
        matched: hit.length,
        without_address: rows.filter((r) => !streetOf(r.address)).length,
        students: hit.slice(0, 60).map((r) => ({ name: r.name, street: streetOf(r.address) || null })),
      };
    },
  },
  {
    name: "birthdays_status",
    label: "ימי הולדת עבריים",
    description: "מי כבר חגג יום הולדת עברי בשנה העברית הנוכחית ומי עוד לא, ומי חוגג בקרוב. מחשב לפי לוח עברי.",
    parameters: obj({ days_ahead: { type: "number", description: "כמה ימים קדימה נחשבים 'בקרוב', ברירת מחדל 30" } }),
    run: async (a, ctx) => {
      const rows = await students(ctx);
      const today = startOfDay(ctx.today);
      const hy = new HDate(today).getFullYear();
      const ahead = Math.min(400, Math.max(1, Number(a?.days_ahead) || 30));
      const passed: unknown[] = []; const notYet: any[] = []; const missing: string[] = [];
      for (const r of rows) {
        if (!r.birth_date) { missing.push(r.name); continue; }
        const d = birthdayInHebrewYear(startOfDay(String(r.birth_date)), hy);
        if (!d) { missing.push(r.name); continue; }
        const diff = dayDiff(d, today);
        const item = { name: r.name, hebrew_birthday: hebrewDayMonth(d), days_from_today: diff };
        if (diff < 0) passed.push(item); else notYet.push(item);
      }
      notYet.sort((x, y) => x.days_from_today - y.days_from_today);
      return {
        hebrew_year_start_note: "שנה עברית מתחילה בתשרי",
        passed_count: passed.length,
        not_yet_count: notYet.length,
        passed,
        not_yet: notYet,
        upcoming: notYet.filter((x) => x.days_from_today <= ahead),
        missing_birth_date: missing,
      };
    },
  },
  {
    name: "weekly_honors_status",
    label: "מצטייני ומשקיעני השבוע",
    description: "מי נבחר בעבר כמצטיין השבוע (excellent) או משקיע השבוע (investing), כמה פעמים ומתי לאחרונה, ומי עוד לא נבחר.",
    parameters: obj({ kind: { type: "string", enum: ["excellent", "investing"], description: "אם לא צוין, שני הסוגים" } }),
    run: async (a, ctx) => {
      const rows = await students(ctx, "id,name");
      const { data, error } = await ctx.supabase.from("weekly_honors").select("student_id,week_start,kind").eq("class_id", ctx.classId);
      if (error) { console.error("[DB Error]", error); throw new Error("טעינת המכובדים נכשלה"); }
      const kinds = a?.kind ? [String(a.kind)] : ["excellent", "investing"];
      const out: Record<string, unknown> = { total_students: rows.length, weeks_recorded: new Set((data ?? []).map((h: any) => h.week_start)).size };
      for (const k of kinds) {
        const mine = (data ?? []).filter((h: any) => h.kind === k);
        const by = new Map<string, string[]>();
        for (const h of mine) by.set(h.student_id, [...(by.get(h.student_id) ?? []), h.week_start]);
        out[k] = {
          honored: rows.filter((r) => by.has(r.id)).map((r) => {
            const w = by.get(r.id)!.sort();
            return { name: r.name, times: w.length, last_week: w[w.length - 1] };
          }),
          never_honored: rows.filter((r) => !by.has(r.id)).map((r) => r.name),
        };
      }
      return out;
    },
  },
  {
    name: "honor_candidates",
    label: "מועמדים לכיבוד",
    description: "מדרג מועמדים למצטיין השבוע (excellent) או משקיע השבוע (investing), לפי נוכחות וביצוע עבודות ב-30 הימים האחרונים (ובמצטיין גם ציונים). מחריג מי שנבחר לאחרונה.",
    parameters: obj({
      kind: { type: "string", enum: ["excellent", "investing"] },
      exclude_recent_weeks: { type: "number", description: "כמה שבועות אחרונים להחריג מי שנבחר, ברירת מחדל 4" },
      limit: { type: "number" },
    }, ["kind"]),
    run: async (a, ctx) => {
      const kind = a?.kind === "excellent" ? "excellent" : "investing";
      const recent = Math.min(26, Math.max(0, Number(a?.exclude_recent_weeks ?? 4)));
      const limit = Math.min(15, Math.max(1, Number(a?.limit) || 8));
      const since = addDaysIso(ctx.today, -30);
      const rows = await students(ctx, "id,name");
      const [att, rat, gr, hon] = await Promise.all([
        ctx.supabase.from("attendance").select("student_id,status").eq("class_id", ctx.classId).gte("date", since),
        ctx.supabase.from("session_ratings").select("student_id,scores,work_done").eq("class_id", ctx.classId).gte("date", since),
        ctx.supabase.from("grades").select("student_id,value,max_value").eq("class_id", ctx.classId).gte("date", since),
        ctx.supabase.from("weekly_honors").select("student_id,week_start,kind").eq("class_id", ctx.classId).eq("kind", kind),
      ]);
      for (const r of [att, rat, gr, hon]) if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת הנתונים נכשלה"); }
      const cutoff = addDaysIso(weekStartIso(ctx.today), -7 * recent);
      const scored = rows.map((s) => {
        const a1 = (att.data ?? []).filter((x: any) => x.student_id === s.id);
        const attendance = a1.length ? a1.filter((x: any) => x.status === "present" || x.status === "late").length / a1.length : null;
        const vals: number[] = [];
        for (const x of (rat.data ?? []).filter((y: any) => y.student_id === s.id)) {
          const sc = (x.scores ?? {}) as Record<string, number>;
          const v = sc.work_done ?? sc.overall ?? x.work_done;
          if (typeof v === "number" && v >= 1 && v <= 3) vals.push((v - 1) / 2);
        }
        const work = vals.length ? vals.reduce((p, c) => p + c, 0) / vals.length : null;
        const g = (gr.data ?? []).filter((x: any) => x.student_id === s.id).map((x: any) => x.value / (x.max_value > 0 ? x.max_value : 100));
        const grades = g.length ? g.reduce((p: number, c: number) => p + c, 0) / g.length : null;
        const parts: [number, number | null][] = kind === "excellent" ? [[0.4, grades], [0.3, work], [0.3, attendance]] : [[0.5, attendance], [0.5, work]];
        const used = parts.filter(([, v]) => v != null) as [number, number][];
        const w = used.reduce((p, [x]) => p + x, 0);
        const score = w > 0 ? used.reduce((p, [x, v]) => p + x * v, 0) / w : 0;
        const times = (hon.data ?? []).filter((h: any) => h.student_id === s.id);
        const last = times.map((h: any) => h.week_start as string).sort().pop() ?? null;
        return {
          name: s.name,
          score: Math.round(score * 100),
          attendance_percent: attendance == null ? null : Math.round(attendance * 100),
          work_percent: work == null ? null : Math.round(work * 100),
          grades_percent: kind === "excellent" ? (grades == null ? null : Math.round(grades * 100)) : undefined,
          times_honored: times.length,
          last_honored_week: last,
          honored_recently: !!last && last >= cutoff,
          has_data: used.length > 0,
        };
      });
      const eligible = scored.filter((s) => !s.honored_recently && s.has_data)
        .sort((x, y) => x.times_honored - y.times_honored || y.score - x.score).slice(0, limit);
      return {
        kind, based_on: "30 ימים אחרונים", excluded_recent_weeks: recent,
        candidates: eligible,
        excluded_recently_honored: scored.filter((s) => s.honored_recently).map((s) => s.name),
        without_data: scored.filter((s) => !s.has_data).map((s) => s.name),
      };
    },
  },
  {
    name: "attendance_summary",
    label: "נוכחות",
    description: "סיכום נוכחות לכל תלמיד בתקופה: אחוז נוכחות, היעדרויות ואיחורים.",
    parameters: obj({ days: { type: "number", description: "כמה ימים אחורה, ברירת מחדל 30" } }),
    run: async (a, ctx) => {
      const days = Math.min(365, Math.max(1, Number(a?.days) || 30));
      const rows = await students(ctx, "id,name");
      const { data, error } = await ctx.supabase.from("attendance").select("student_id,status").eq("class_id", ctx.classId).gte("date", addDaysIso(ctx.today, -days));
      if (error) { console.error("[DB Error]", error); throw new Error("טעינת הנוכחות נכשלה"); }
      return {
        days,
        students: rows.map((s) => {
          const x = (data ?? []).filter((r: any) => r.student_id === s.id);
          const good = x.filter((r: any) => r.status === "present" || r.status === "late").length;
          return {
            name: s.name, records: x.length,
            attendance_percent: x.length ? Math.round((good / x.length) * 100) : null,
            absent: x.filter((r: any) => r.status === "absent").length,
            late: x.filter((r: any) => r.status === "late").length,
          };
        }),
      };
    },
  },
  {
    name: "schedule_week",
    label: "מערכת השעות",
    description: "שיעורי השבוע לפי מערכת השעות: יום, שעה ומקצוע.",
    parameters: obj({ week_of: { type: "string", description: "תאריך YYYY-MM-DD בתוך השבוע. ברירת מחדל: השבוע" } }),
    run: async (a, ctx) => {
      const ws = weekStartIso(/^\d{4}-\d{2}-\d{2}$/.test(String(a?.week_of ?? "")) ? String(a.week_of) : ctx.today);
      const { data, error } = await ctx.supabase.from("weekly_lessons").select("day_key,hour,minute,subject,title,notes").eq("class_id", ctx.classId).eq("week_start", ws);
      if (error) { console.error("[DB Error]", error); throw new Error("טעינת המערכת נכשלה"); }
      return {
        week_start: ws,
        lessons: (data ?? [])
          .map((l: any) => ({ date: lessonDateIso(ws, l.day_key), time: hhmm(l.hour, l.minute ?? 0), subject: lessonName(l), note: l.notes || undefined }))
          .sort((x: any, y: any) => x.date.localeCompare(y.date) || x.time.localeCompare(y.time)),
      };
    },
  },
  {
    name: "pacing_status",
    label: "תכנון קצב שנתי",
    description: "מה הוגדר לכל מקצוע בתכנון הקצב השנתי, ומה מתוכנן להספיק השבוע.",
    parameters: obj({}),
    run: async (_a, ctx) => {
      const ws = weekStartIso(ctx.today);
      const [p, w] = await Promise.all([
        ctx.supabase.from("pacing_subject_plans").select("subject,mode,total_amount,unit_label,start_number").eq("class_id", ctx.classId),
        ctx.supabase.from("pacing_plan_weeks").select("subject,lessons,amount,from_label,to_label,topics,status").eq("class_id", ctx.classId).eq("week_start", ws),
      ]);
      if (p.error || w.error) { console.error("[DB Error]", p.error ?? w.error); throw new Error("טעינת התכנון נכשלה"); }
      return { plans: p.data ?? [], this_week: w.data ?? [], note: (p.data ?? []).length ? undefined : "עוד לא הוגדר תכנון קצב" };
    },
  },
  {
    name: "class_overview",
    label: "סקירת הכיתה",
    description: "סקירה קצרה: מספר תלמידים, נוכחות היום, הודעות פעילות ואירועים קרובים.",
    parameters: obj({}),
    run: async (_a, ctx) => {
      const [st, att, ann, ev] = await Promise.all([
        ctx.supabase.from("students").select("id", { count: "exact", head: true }).eq("class_id", ctx.classId),
        ctx.supabase.from("attendance").select("status").eq("class_id", ctx.classId).eq("date", ctx.today),
        ctx.supabase.from("class_announcements").select("title,severity").eq("class_id", ctx.classId).order("created_at", { ascending: false }).limit(5),
        ctx.supabase.from("class_events").select("title,type,date").eq("class_id", ctx.classId).gte("date", ctx.today).order("date", { ascending: true }).limit(6),
      ]);
      const a = (att.data ?? []) as any[];
      return {
        today: ctx.today, weekday: dayKeyOfIso(ctx.today),
        students: st.count ?? 0,
        attendance_today: { recorded: a.length, present: a.filter((x) => x.status === "present").length, absent: a.filter((x) => x.status === "absent").length, late: a.filter((x) => x.status === "late").length },
        announcements: ann.data ?? [],
        upcoming_events: ev.data ?? [],
      };
    },
  },
];

export const readToolByName = (name: string) => READ_TOOLS.find((t) => t.name === name);
export { isoDate };

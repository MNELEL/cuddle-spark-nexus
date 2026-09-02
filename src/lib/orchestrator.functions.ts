import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  evaluateAttendanceDecline, describeDecline,
  evaluateAbsenceStreak, describeAbsenceStreak,
} from "./attendance-decline";
import {
  evaluateGradeDecline,
  describeGradeDecline,
  gradeAverage,
  evaluateGradeOutlier,
  describeGradeOutlier,
  evaluateBelowClassAverage,
  describeBelowClassAverage,
} from "./grade-decline";
import {
  evaluateBehaviorDecline, describeBehaviorDecline,
  evaluateDisciplineSpike, describeDisciplineSpike,
} from "./behavior-signals";
import {
  evaluateAttendanceGap, evaluateGradesGap, evaluateBulletinGap, describeGap,
} from "./data-gaps";

export type DailyInsight = {
  id: string;
  class_id: string;
  class_name: string;
  student_id: string | null;
  student_name: string | null;
  insight_type: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  suggested_action: string | null;
  action_link: string | null;
  created_at: string;
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * סורקת את כל כיתות המלמד המחובר ומייצרת תובנות "ירידה בנוכחות".
 * ההשוואה: 7 הימים האחרונים מול 30 הימים שלפניהם.
 */
export const generateDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: classes, error: cErr } = await supabase
      .from("classes")
      .select("id,name,status")
      .eq("owner_id", userId);
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הסריקה נכשלה. נסה שוב."); }

    const activeClasses = (classes ?? []).filter((c) => c.status !== "archived");
    if (activeClasses.length === 0) return { created: 0, scanned: 0 };

    const recentFrom = isoDaysAgo(7);
    const baseFrom = isoDaysAgo(37);

    type NewInsight = {
      owner_id: string;
      class_id: string;
      student_id: string | null;
      insight_type: string;
      severity: "medium" | "high";
      title: string;
      description: string;
      suggested_action: string;
      action_link: string;
    };

    const pending: NewInsight[] = [];
    let scanned = 0;
    const today = new Date().toISOString().slice(0, 10);
    const spikeFrom = isoDaysAgo(14);

    for (const cls of activeClasses) {
      const [studentsRes, attRes, gradesRes, behRes, discRes, bulletinRes] = await Promise.all([
        supabase.from("students").select("id,name").eq("class_id", cls.id),
        supabase
          .from("attendance")
          .select("student_id,date,status")
          .eq("class_id", cls.id)
          .gte("date", baseFrom),
        supabase
          .from("grades")
          .select("student_id,date,value,max_value")
          .eq("class_id", cls.id)
          .gte("date", baseFrom),
        supabase
          .from("behavior_points")
          .select("student_id,date,points")
          .eq("class_id", cls.id)
          .gte("date", baseFrom),
        supabase
          .from("discipline_events")
          .select("student_id,date,type,severity")
          .eq("class_id", cls.id)
          .gte("date", baseFrom),
        supabase
          .from("weekly_bulletins")
          .select("start_date,status,published_at")
          .eq("class_id", cls.id)
          .gte("start_date", isoDaysAgo(90)),
      ]);
      const clsErr =
        studentsRes.error || attRes.error || gradesRes.error ||
        behRes.error || discRes.error || bulletinRes.error;
      if (clsErr) {
        console.error("[DB Error]", clsErr);
        throw new Error("הסריקה נכשלה. נסה שוב.");
      }

      const students = studentsRes.data ?? [];
      const rows = attRes.data ?? [];
      const gradeRows = gradesRes.data ?? [];
      const behaviorRows = behRes.data ?? [];
      const disciplineRows = discRes.data ?? [];
      const bulletinRows = bulletinRes.data ?? [];
      scanned += students.length;

      /* ---- סיגנלים ברמת הכיתה ---- */
      if (students.length > 0) {
        const attGap = evaluateAttendanceGap(rows.map((r) => r.date), today);
        if (attGap) {
          pending.push({
            owner_id: userId, class_id: cls.id, student_id: null,
            insight_type: "attendance_gap", severity: attGap.severity,
            title: `נוכחות לא נרשמה - ${cls.name}`,
            description: describeGap(attGap, "נוכחות"),
            suggested_action: "השלם את רישום הנוכחות בימים החסרים",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }

        const gradeGap = evaluateGradesGap(gradeRows.map((g) => g.date), today);
        if (gradeGap) {
          pending.push({
            owner_id: userId, class_id: cls.id, student_id: null,
            insight_type: "grades_gap", severity: gradeGap.severity,
            title: `לא נרשמו ציונים - ${cls.name}`,
            description: describeGap(gradeGap, "ציונים"),
            suggested_action: "הזן ציונים למבחנים ולבחנים האחרונים",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }

        const bulletinGap = evaluateBulletinGap(
          bulletinRows
            .filter((b) => b.status === "published" || b.published_at)
            .map((b) => (b.published_at ? b.published_at.slice(0, 10) : b.start_date)),
          today,
        );
        if (bulletinGap) {
          pending.push({
            owner_id: userId, class_id: cls.id, student_id: null,
            insight_type: "bulletin_gap", severity: bulletinGap.severity,
            title: `עלון שבועי לא פורסם - ${cls.name}`,
            description: describeGap(bulletinGap, "עלון שבועי"),
            suggested_action: "הפק ופרסם את העלון השבועי להורים",
            action_link: `/bulletins/${cls.id}`,
          });
        }

        // ירידה בממוצע הכיתתי — כל ציוני הכיתה, שבוע אחרון מול החלון שלפניו.
        const classRecent = gradeRows.filter((g) => g.date >= recentFrom);
        const classBase = gradeRows.filter((g) => g.date < recentFrom);
        const classDecline = evaluateGradeDecline(classRecent, classBase);
        if (classDecline && classRecent.length >= students.length) {
          pending.push({
            owner_id: userId, class_id: cls.id, student_id: null,
            insight_type: "class_grade_decline", severity: classDecline.severity,
            title: `ירידה בממוצע הכיתתי - ${cls.name}`,
            description: describeGradeDecline(classDecline),
            suggested_action: "שקול חזרה כיתתית על החומר האחרון",
            action_link: `/analytics/${cls.id}`,
          });
        }

        const classAvg = gradeAverage(classRecent);
        if (classAvg !== null) {
          // מידע לוגי בלבד — עוזר לאבחון סריקות בלוגים.
          console.info(`[briefing] class=${cls.id} recentAvg=${Math.round(classAvg)}`);
        }
      }

      for (const st of students) {
        const mine = rows.filter((r) => r.student_id === st.id);
        const recent = mine.filter((r) => r.date >= recentFrom).map((r) => r.status);
        const base = mine.filter((r) => r.date < recentFrom).map((r) => r.status);

        const decline = evaluateAttendanceDecline(recent, base);
        if (decline) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "attendance_decline",
            severity: decline.severity,
            title: `ירידה בנוכחות - ${st.name}`,
            description: describeDecline(decline),
            suggested_action: "בדוק מה קרה בשבוע האחרון וצור קשר עם ההורים",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }

        // היעדרות רצופה — סיגנל נפרד, גם כשאין ירידה מול הבסיס.
        const streak = evaluateAbsenceStreak(mine.map((r) => ({ date: r.date, status: r.status })));
        if (streak) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "absence_streak",
            severity: streak.severity,
            title: `היעדרות רצופה - ${st.name}`,
            description: describeAbsenceStreak(streak),
            suggested_action: "התקשר להורים לבדוק את סיבת ההיעדרות",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }

        // ירידה בציונים — 7 ימים אחרונים מול החלון שלפניהם.
        const myGrades = gradeRows.filter((g) => g.student_id === st.id);
        const gDecline = evaluateGradeDecline(
          myGrades.filter((g) => g.date >= recentFrom),
          myGrades.filter((g) => g.date < recentFrom),
        );
        if (gDecline) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "grade_decline",
            severity: gDecline.severity,
            title: `ירידה בציונים - ${st.name}`,
            description: describeGradeDecline(gDecline),
            suggested_action: "בדוק אילו נושאים קשים לו והצע חזרה ממוקדת",
            action_link: `/analytics/${cls.id}`,
          });
        }

        // כשל חד-פעמי אצל תלמיד חזק — "נכון ל-90 אך נפסל במבחן".
        const outlier = evaluateGradeOutlier(myGrades);
        if (outlier) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "grade_outlier",
            severity: outlier.severity,
            title: `כשל חריג במבחן - ${st.name}`,
            description: describeGradeOutlier(outlier),
            suggested_action: "בדוק את המבחן מול התלמיד ושקול הזדמנות נוספת",
            action_link: `/analytics/${cls.id}`,
          });
        }

        // פער מול ממוצע הכיתה באותה תקופה.
        const classGap = evaluateBelowClassAverage(
          myGrades.filter((g) => g.date >= recentFrom),
          gradeRows.filter((g) => g.date >= recentFrom),
        );
        if (classGap) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "below_class_average",
            severity: classGap.severity,
            title: `פער מול ממוצע הכיתה - ${st.name}`,
            description: describeBelowClassAverage(classGap),
            suggested_action: "שקול תרגול נוסף או חונכות אישית",
            action_link: `/analytics/${cls.id}`,
          });
        }

        // ירידה בהתנהגות — ממוצע נקודות ההתנהגות לרישום.
        const myBehavior = behaviorRows.filter((b) => b.student_id === st.id);
        const bDecline = evaluateBehaviorDecline(
          myBehavior.filter((b) => b.date >= recentFrom),
          myBehavior.filter((b) => b.date < recentFrom),
        );
        if (bDecline) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "behavior_decline",
            severity: bDecline.severity,
            title: `ירידה בהתנהגות - ${st.name}`,
            description: describeBehaviorDecline(bDecline),
            suggested_action: "שוחח איתו ביחידות ושקול תגבור חיובי",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }

        // ריבוי אירועי משמעת בשבועיים האחרונים.
        const spike = evaluateDisciplineSpike(
          disciplineRows.filter((d) => d.student_id === st.id && d.date >= spikeFrom),
        );
        if (spike) {
          pending.push({
            owner_id: userId,
            class_id: cls.id,
            student_id: st.id,
            insight_type: "discipline_spike",
            severity: spike.severity,
            title: `ריבוי אירועי משמעת - ${st.name}`,
            description: describeDisciplineSpike(spike),
            suggested_action: "עדכן את ההורים ובנה תוכנית התנהגות ממוקדת",
            action_link: `/classes/${cls.id}?tab=tracking`,
          });
        }
      }
    }

    if (pending.length === 0) return { created: 0, scanned };

    // מונע כפילויות: תובנה פעילה מאותו סוג לאותו תלמיד/כיתה מ-7 הימים האחרונים.
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: eErr } = await supabase
      .from("orchestrator_insights")
      .select("class_id,student_id,insight_type")
      .eq("is_dismissed", false)
      .gte("created_at", sinceIso);
    if (eErr) { console.error("[DB Error]", eErr); throw new Error("הסריקה נכשלה. נסה שוב."); }

    const key = (r: { class_id: string; student_id: string | null; insight_type: string }) =>
      `${r.student_id ?? `class:${r.class_id}`}|${r.insight_type}`;
    const seen = new Set((existing ?? []).map(key));
    const toInsert = pending.filter((p) => {
      const k = key(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (toInsert.length === 0) return { created: 0, scanned };

    // אין מדיניות INSERT ללקוח — הכתיבה נעשית בשרת בלבד, עם owner_id מהטוקן.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin
      .from("orchestrator_insights")
      .insert(toInsert as never);
    if (insErr) { console.error("[DB Error]", insErr); throw new Error("שמירת התובנות נכשלה."); }

    return { created: toInsert.length, scanned };
  });

/** כל התובנות הפעילות של המלמד המחובר, ממוינות לפי חומרה ואז תאריך. */
export const listDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyInsight[]> => {
    const { data, error } = await context.supabase
      .from("orchestrator_insights")
      .select(
        "id,class_id,student_id,insight_type,severity,title,description,suggested_action,action_link,created_at," +
          "classes(name),students(name)",
      )
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת התובנות נכשלה."); }

    const rows = (data ?? []) as unknown as (Omit<DailyInsight, "class_name" | "student_name"> & {
      classes: { name: string } | null;
      students: { name: string } | null;
    })[];

    return rows
      .map((r) => ({
        id: r.id,
        class_id: r.class_id,
        class_name: r.classes?.name ?? "",
        student_id: r.student_id,
        student_name: r.students?.name ?? null,
        insight_type: r.insight_type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        suggested_action: r.suggested_action,
        action_link: r.action_link,
        created_at: r.created_at,
      }))
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
          b.created_at.localeCompare(a.created_at),
      );
  });

/** מסלק תובנה בודדת — רק אם היא של המשתמש המחובר. */
export const dismissInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("orchestrator_insights")
      .update({ is_dismissed: true } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .select("id");
    if (error) { console.error("[DB Error]", error); throw new Error("סילוק התובנה נכשל."); }
    if (!updated || updated.length === 0) throw new Error("התובנה לא נמצאה");
    return { ok: true };
  });

/* -------- מאגר היסטוריה של תלמיד -------- */

export type TimelineKind = "attendance" | "grade" | "behavior" | "discipline" | "parent_call" | "event";

export type TimelineItem = {
  kind: TimelineKind;
  date: string;
  title: string;
  detail: string;
};

/**
 * ציר זמן מאוחד של תלמיד אחד — נוכחות, ציונים, התנהגות, אירועי משמעת,
 * שיחות עם הורים ואירועי לוח. RLS מוודאת שהמלמד רואה רק את כיתותיו.
 */
export const getStudentTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      days: z.number().int().min(7).max(365).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ studentName: string; items: TimelineItem[] }> => {
    const { supabase } = context;
    const fromIso = isoDaysAgo(data.days ?? 120);

    const [stRes, attRes, grRes, behRes, discRes, pcRes, evRes] = await Promise.all([
      supabase.from("students").select("name").eq("id", data.studentId).maybeSingle(),
      supabase.from("attendance").select("date,status,notes").eq("student_id", data.studentId).gte("date", fromIso),
      supabase.from("grades").select("date,subject,value,max_value,notes").eq("student_id", data.studentId).gte("date", fromIso),
      supabase.from("behavior_points").select("date,category,points,note").eq("student_id", data.studentId).gte("date", fromIso),
      supabase.from("discipline_events").select("date,type,category,description").eq("student_id", data.studentId).gte("date", fromIso),
      supabase.from("parent_communications").select("date,channel,subject,summary").eq("student_id", data.studentId).gte("date", fromIso),
      supabase.from("class_events").select("date,title,type,notes").eq("student_id", data.studentId).gte("date", fromIso),
    ]);

    const firstErr = stRes.error || attRes.error || grRes.error || behRes.error || discRes.error || pcRes.error || evRes.error;
    if (firstErr) { console.error("[DB Error]", firstErr); throw new Error("טעינת ההיסטוריה נכשלה."); }
    if (!stRes.data) throw new Error("התלמיד לא נמצא");

    const STATUS: Record<string, string> = {
      present: "נוכח", absent: "נעדר", late: "איחור", excused: "מאושר",
    };
    const items: TimelineItem[] = [
      ...(attRes.data ?? []).map((r) => ({
        kind: "attendance" as const, date: r.date,
        title: `נוכחות: ${STATUS[r.status] ?? r.status}`,
        detail: r.notes ?? "",
      })),
      ...(grRes.data ?? []).map((r) => ({
        kind: "grade" as const, date: r.date,
        title: `ציון${r.subject ? ` ב${r.subject}` : ""}: ${r.value}/${r.max_value ?? 100}`,
        detail: r.notes ?? "",
      })),
      ...(behRes.data ?? []).map((r) => ({
        kind: "behavior" as const, date: r.date,
        title: `${r.points >= 0 ? "+" : ""}${r.points} נקודות התנהגות${r.category ? ` · ${r.category}` : ""}`,
        detail: r.note ?? "",
      })),
      ...(discRes.data ?? []).map((r) => ({
        kind: "discipline" as const, date: r.date,
        title: `רישום משמעת${r.category ? ` · ${r.category}` : ""}`,
        detail: r.description ?? "",
      })),
      ...(pcRes.data ?? []).map((r) => ({
        kind: "parent_call" as const, date: r.date,
        title: `קשר עם ההורים${r.subject ? ` · ${r.subject}` : ""}`,
        detail: r.summary ?? "",
      })),
      ...(evRes.data ?? []).map((r) => ({
        kind: "event" as const, date: r.date,
        title: `אירוע בלוח: ${r.title}`,
        detail: r.notes ?? "",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { studentName: stRes.data.name ?? "", items };
  });

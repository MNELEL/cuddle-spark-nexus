import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";
import { smartAssign, type ScoringStudent, type ScoringRelation, type SeatPos } from "./seating-logic.ts";

const ATTENTION_KEYWORDS = ["קשב", "ריכוז", "הפרעה", "תזוזה"];

export type WizardPlacement = { studentId: string; row: number; col: number };

export type WizardResult = {
  placements: WizardPlacement[];
  reasoning: string;
  usedAI: boolean;
  classAnalysis: {
    strugglingCount: number;
    excellingCount: number;
    attentionCount: number;
    totalStudents: number;
  };
};

export const runSeatingWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      weightAcademic: z.number().int().min(0).max(100),
      weightBehavioral: z.number().int().min(0).max(100),
      weightSocial: z.number().int().min(0).max(100),
      balanceHeight: z.boolean(),
      freeInstruction: z.string().max(500).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WizardResult> => {
    const { classId, weightAcademic, weightBehavioral, weightSocial, balanceHeight, freeInstruction } = data;
    const { supabase } = context;

    // 1. Class + students + grades + behavior + relations
    const [cls, studentsRes, gradesRes, behaviorRes, relationsRes] = await Promise.all([
      supabase.from("classes")
        .select("grid_rows, grid_cols, hidden_seats, room_objects").eq("id", classId).single(),
      supabase.from("students")
        .select("id, name, height, row_pref, corner_pref, seat_row, seat_col, seat_locked, notes")
        .eq("class_id", classId),
      supabase.from("grades")
        .select("student_id, value, max_value").eq("class_id", classId),
      supabase.from("behavior_points")
        .select("student_id, points, note").eq("class_id", classId),
      supabase.from("student_relations")
        .select("student_a, student_b, kind").eq("class_id", classId),
    ]);

    if (cls.error) { console.error("[DB Error]", cls.error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (studentsRes.error) { console.error("[DB Error]", studentsRes.error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const students = studentsRes.data ?? [];
    const grades = gradesRes.data ?? [];
    const behavior = behaviorRes.data ?? [];
    const relations = relationsRes.data ?? [];
    const rows = cls.data.grid_rows;
    const cols = cls.data.grid_cols;
    const hiddenSeats = new Set<string>(
      Array.isArray(cls.data.hidden_seats) ? (cls.data.hidden_seats as string[]) : [],
    );
    // Cells taken by room objects (window, board, cabinet...) are not seatable.
    const roomObjs = Array.isArray((cls.data as { room_objects?: unknown }).room_objects)
      ? ((cls.data as { room_objects?: unknown }).room_objects as Array<{ row?: number; col?: number }>)
      : [];
    for (const o of roomObjs) {
      if (typeof o?.row === "number" && typeof o?.col === "number") hiddenSeats.add(`${o.row}:${o.col}`);
    }

    // 2. Averages per student (grades as % of max_value)
    const avgByStudent = new Map<string, number>();
    const sumByStudent = new Map<string, { total: number; count: number }>();
    for (const g of grades) {
      const pct = g.max_value > 0 ? (g.value / g.max_value) * 100 : 0;
      const cur = sumByStudent.get(g.student_id) ?? { total: 0, count: 0 };
      cur.total += pct;
      cur.count += 1;
      sumByStudent.set(g.student_id, cur);
    }
    for (const [sid, { total, count }] of sumByStudent) {
      avgByStudent.set(sid, count > 0 ? total / count : 0);
    }

    // 3. Behavior net points per student
    const behaviorNetByStudent = new Map<string, number>();
    const behaviorNotesByStudent = new Map<string, string[]>();
    for (const b of behavior) {
      behaviorNetByStudent.set(b.student_id, (behaviorNetByStudent.get(b.student_id) ?? 0) + (b.points ?? 0));
      if (b.note) {
        const arr = behaviorNotesByStudent.get(b.student_id) ?? [];
        arr.push(b.note);
        behaviorNotesByStudent.set(b.student_id, arr);
      }
    }

    // 4. Pre-analysis: struggling / excelling / attention-difficulty counts
    let strugglingCount = 0;
    let excellingCount = 0;
    let attentionCount = 0;
    for (const s of students) {
      const avg = avgByStudent.get(s.id);
      if (avg !== undefined) {
        if (avg < 70) strugglingCount++;
        if (avg > 90) excellingCount++;
      }
      const textBlob = [
        s.notes ?? "",
        ...(behaviorNotesByStudent.get(s.id) ?? []),
      ].join(" ");
      if (ATTENTION_KEYWORDS.some((kw) => textBlob.includes(kw))) attentionCount++;
    }

    const classAnalysis = {
      strugglingCount,
      excellingCount,
      attentionCount,
      totalStudents: students.length,
    };

    // 5. Deterministic fallback engine (always computed first as safety net)
    const scoringStudents: ScoringStudent[] = students.map((s) => ({
      id: s.id,
      height: (s.height as "low" | "mid" | "high") ?? "mid",
      row_pref: (s.row_pref as "front" | "mid" | "back" | "any") ?? "any",
      corner_pref: !!s.corner_pref,
      seat_row: s.seat_row,
      seat_col: s.seat_col,
      seat_locked: !!s.seat_locked,
    }));
    const scoringRelations: ScoringRelation[] = relations.map((r) => ({
      student_a: r.student_a,
      student_b: r.student_b,
      kind: r.kind as "friend" | "avoid" | "distance",
    }));

    const fallbackAssign = (): WizardResult => {
      const assign = smartAssign(scoringStudents, scoringRelations, rows, cols, hiddenSeats);
      const placements: WizardPlacement[] = [];
      for (const [studentId, pos] of assign) {
        if (pos) placements.push({ studentId, row: pos.row, col: pos.col });
      }
      return {
        placements,
        reasoning: "סודר באמצעות אלגוריתם מקומי (ללא AI) בשל עומס זמני על השירות.",
        usedAI: false,
        classAnalysis,
      };
    };

    // 6. Try AI placement
    const studentsForAI = students.map((s) => ({
      id: s.id,
      name: s.name,
      height: s.height,
      rowPref: s.row_pref,
      cornerPref: s.corner_pref,
      locked: s.seat_locked,
      lockedRow: s.seat_row,
      lockedCol: s.seat_col,
      academicAvg: avgByStudent.get(s.id) ?? null,
      behaviorNet: behaviorNetByStudent.get(s.id) ?? 0,
      hasAttentionNotes: (() => {
        const textBlob = [s.notes ?? "", ...(behaviorNotesByStudent.get(s.id) ?? [])].join(" ");
        return ATTENTION_KEYWORDS.some((kw) => textBlob.includes(kw));
      })(),
    }));

    const relationsForAI = relations.map((r) => ({
      studentA: r.student_a,
      studentB: r.student_b,
      kind: r.kind,
    }));

    const system = `אתה מומחה לסידור ישיבה בכיתה בתלמוד תורה/חיידר, עובד בעברית.
תפקידך: להציע סידור הושבה לגריד בגודל ${rows} שורות × ${cols} טורים (שורה 0 = הקדמית ביותר).
מושבים חסומים (לא ניתן להושיב בהם): ${JSON.stringify(Array.from(hiddenSeats))}.
תלמידים עם locked=true חייבים להישאר במקום lockedRow/lockedCol שלהם בדיוק — אל תזיז אותם.

שקלול שביקש המורה (0-100 לכל אחד, ביחס יחסי ביניהם):
- משקל אקדמי: ${weightAcademic} (איזון בין תלמידים מתקשים למצטיינים בכיתה)
- משקל התנהגותי: ${weightBehavioral} (הרחקת תלמידים עם קשיי התנהגות מהפרעות הדדיות, שיבוץ קרוב למורה/שורה קדמית לפי הצורך)
- משקל חברתי: ${weightSocial} (התחשבות בקשרי friend/avoid/distance בין תלמידים)
- איזון גובה בין שורות: ${balanceHeight ? "כן — תלמידים גבוהים מאחור, נמוכים מקדימה" : "לא רלוונטי"}

ניתוח כיתה מקדים: ${strugglingCount} תלמידים מתקשים (ממוצע<70), ${excellingCount} מצטיינים (ממוצע>90), ${attentionCount} עם אינדיקציות לקשיי קשב/ריכוז.

${freeInstruction ? `הנחיה חופשית נוספת מהמורה: "${freeInstruction}"` : ""}

החזר אך ורק JSON בפורמט:
{"placements": [{"studentId": "...", "seatRow": 0, "seatCol": 0}, ...], "reasoning": "הסבר קצר בעברית (2-4 משפטים) מדוע כך שובצו התלמידים, מותאם למשקלים שנבחרו"}
כל תלמיד לא-locked חייב לקבל מושב פנוי אחד (לא חסום, לא תפוס על ידי locked אחר, לא כפול).`;

    try {
      const raw = await callLovableAI({
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ students: studentsForAI, relations: relationsForAI }) },
        ],
        jsonResponse: true,
      });

      const parsed = JSON.parse(raw) as {
        placements: { studentId: string; seatRow: number; seatCol: number }[];
        reasoning: string;
      };

      if (!Array.isArray(parsed.placements) || parsed.placements.length === 0) {
        throw new Error("AI החזיר תוצאה ריקה");
      }

      // Validate: every returned seat is in-bounds, not hidden, no duplicate seats, no duplicate students
      const seenSeats = new Set<string>();
      const seenStudents = new Set<string>();
      const validIds = new Set(students.map((s) => s.id));
      const placements: WizardPlacement[] = [];
      for (const p of parsed.placements) {
        if (!validIds.has(p.studentId)) continue;
        if (seenStudents.has(p.studentId)) continue;
        if (p.seatRow < 0 || p.seatRow >= rows || p.seatCol < 0 || p.seatCol >= cols) continue;
        const seatKey = `${p.seatRow}:${p.seatCol}`;
        if (hiddenSeats.has(seatKey)) continue;
        if (seenSeats.has(seatKey)) continue;
        seenSeats.add(seatKey);
        seenStudents.add(p.studentId);
        placements.push({ studentId: p.studentId, row: p.seatRow, col: p.seatCol });
      }

      // If AI produced too few valid placements (missed most of the class), treat as failure
      const movableCount = students.filter((s) => !s.seat_locked).length;
      if (placements.length < Math.ceil(movableCount * 0.7)) {
        throw new Error("תוצאת AI לא תקינה מספיק — נופל לפתרון מקומי");
      }

      return {
        placements,
        reasoning: (parsed.reasoning || "").slice(0, 1000),
        usedAI: true,
        classAnalysis,
      };
    } catch (e) {
      console.error("[seating wizard AI]", e);
      return fallbackAssign();
    }
  });

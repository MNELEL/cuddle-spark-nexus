import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffTitleLabel } from "./institution-staff.functions";

/**
 * מסך "בית הספר": המוסד, הכיתות של המשתמש, ולמנהל גם רשימת המלמדים עם הכיתות שלהם.
 * המוסד והתפקיד נגזרים תמיד מהתפקידים של המשתמש עצמו, לא מקלט מהדפדפן.
 * תואר (רב, ר״מ ועוד) הוא תצוגה בלבד ולא משנה הרשאות.
 */
export type SchoolKind = "talmud_torah" | "cheder" | "yeshiva";
export const SCHOOL_KIND_LABEL: Record<SchoolKind, string> = {
  talmud_torah: "תלמוד תורה",
  cheder: "חיידר",
  yeshiva: "ישיבה",
};

export type SchoolClass = {
  id: string;
  name: string;
  status: string;
  students: number;
  academicYear: string | null;
};

export type SchoolTeacher = {
  userId: string | null;
  name: string;
  titleLabel: string | null;
  classes: SchoolClass[];
};

export type SchoolHome = {
  institution: { id: string; name: string; kind: SchoolKind } | null;
  isManager: boolean;
  isSystemAdmin: boolean;
  roleLabels: string[];
  myTitle: string | null;
  myClasses: SchoolClass[];
  teachers: SchoolTeacher[];
  totals: { activeClasses: number; students: number; teachers: number } | null;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל",
  teacher: "מלמד",
  secretary: "מזכיר",
};

function countBy(rows: { class_id: string }[] | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.class_id, (m.get(r.class_id) ?? 0) + 1);
  return m;
}

export const getSchoolHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchoolHome> => {
    const supabase = context.supabase as any;
    const userId = context.userId as string;

    const { data: roleRows, error: rErr } = await supabase
      .from("user_roles")
      .select("role, institution_id")
      .eq("user_id", userId);
    if (rErr) { console.error("[DB Error]", rErr); throw new Error("טעינת בית הספר נכשלה."); }

    const roles = (roleRows ?? []) as { role: string; institution_id: string | null }[];
    const withInstitution = roles.filter((r) => r.institution_id);
    const managerRow = withInstitution.find((r) => r.role === "principal" || r.role === "admin");
    const chosen = managerRow ?? withInstitution[0] ?? null;
    const institutionId = chosen?.institution_id ?? null;
    const isManager = Boolean(managerRow);
    const isSystemAdmin = roles.some((r) => r.role === "admin");
    const roleLabels = Array.from(new Set(roles.map((r) => ROLE_LABEL[r.role] ?? r.role)));

    // הכיתות של המשתמש עצמו (RLS מגביל לבעלים)
    const { data: mine, error: mErr } = await supabase
      .from("classes")
      .select("id, name, status, academic_year")
      .eq("owner_id", userId)
      .order("name", { ascending: true });
    if (mErr) { console.error("[DB Error]", mErr); throw new Error("טעינת הכיתות נכשלה."); }
    const myIds = (mine ?? []).map((c: any) => c.id as string);
    let myCounts = new Map<string, number>();
    if (myIds.length) {
      const { data: st, error: sErr } = await supabase.from("students").select("class_id").in("class_id", myIds);
      if (sErr) { console.error("[DB Error]", sErr); throw new Error("טעינת התלמידים נכשלה."); }
      myCounts = countBy(st);
    }
    const toClass = (c: any, counts: Map<string, number>): SchoolClass => ({
      id: c.id,
      name: c.name,
      status: c.status,
      students: counts.get(c.id) ?? 0,
      academicYear: c.academic_year ?? null,
    });
    const myClasses = (mine ?? []).map((c: any) => toClass(c, myCounts));

    if (!institutionId) {
      return { institution: null, isManager: false, isSystemAdmin, roleLabels, myTitle: null, myClasses, teachers: [], totals: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [{ data: inst, error: iErr }, { data: staff, error: stErr }] = await Promise.all([
      admin.from("institutions").select("id, name, kind").eq("id", institutionId).maybeSingle(),
      admin.from("institution_staff").select("user_id, name, title, active").eq("institution_id", institutionId).eq("active", true),
    ]);
    if (iErr || stErr) { console.error("[DB Error]", iErr ?? stErr); throw new Error("טעינת פרטי המוסד נכשלה."); }
    if (!inst) {
      return { institution: null, isManager: false, isSystemAdmin, roleLabels, myTitle: null, myClasses, teachers: [], totals: null };
    }

    const staffRows = (staff ?? []) as { user_id: string | null; name: string; title: string }[];
    const mineStaff = staffRows.find((s) => s.user_id === userId);
    const myTitle = mineStaff ? staffTitleLabel(mineStaff.title) : null;

    const base = {
      institution: { id: inst.id as string, name: inst.name as string, kind: (inst.kind ?? "talmud_torah") as SchoolKind },
      isSystemAdmin,
      roleLabels,
      myTitle,
      myClasses,
    };

    if (!isManager) {
      return { ...base, isManager: false, teachers: [], totals: null };
    }

    // מנהל: כל כיתות המוסד, מקובצות לפי מלמד
    const [{ data: classRows, error: cErr }, { data: memberRows, error: memErr }] = await Promise.all([
      admin.from("classes").select("id, name, status, owner_id, academic_year").eq("institution_id", institutionId),
      admin.from("user_roles").select("user_id, role").eq("institution_id", institutionId),
    ]);
    if (cErr || memErr) { console.error("[DB Error]", cErr ?? memErr); throw new Error("טעינת כיתות המוסד נכשלה."); }

    const classes = (classRows ?? []) as any[];
    const classIds = classes.map((c) => c.id as string);
    let counts = new Map<string, number>();
    if (classIds.length) {
      const { data: st, error: sErr } = await admin.from("students").select("class_id").in("class_id", classIds);
      if (sErr) { console.error("[DB Error]", sErr); throw new Error("טעינת התלמידים נכשלה."); }
      counts = countBy(st);
    }

    const teacherIds = new Set<string>();
    for (const c of classes) teacherIds.add(c.owner_id as string);
    for (const m of (memberRows ?? []) as { user_id: string; role: string }[]) {
      if (m.role === "teacher" || m.role === "principal") teacherIds.add(m.user_id);
    }
    const names = new Map<string, string>();
    if (teacherIds.size) {
      const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", Array.from(teacherIds));
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, p.display_name ?? "");
    }

    const titleByUser = new Map<string, string>();
    const titleByName = new Map<string, string>();
    for (const s of staffRows) {
      if (s.user_id) titleByUser.set(s.user_id, staffTitleLabel(s.title));
      titleByName.set(s.name.trim(), staffTitleLabel(s.title));
    }

    const teachers: SchoolTeacher[] = Array.from(teacherIds).map((id) => {
      const name = names.get(id)?.trim() || "מלמד ללא שם";
      return {
        userId: id,
        name,
        titleLabel: titleByUser.get(id) ?? titleByName.get(name) ?? null,
        classes: classes
          .filter((c) => c.owner_id === id)
          .map((c) => toClass(c, counts))
          .sort((a, b) => (a.status === "archived" ? 1 : 0) - (b.status === "archived" ? 1 : 0) || a.name.localeCompare(b.name, "he")),
      };
    });
    teachers.sort((a, b) => a.name.localeCompare(b.name, "he"));

    const active = classes.filter((c) => c.status !== "archived");
    return {
      ...base,
      isManager: true,
      teachers,
      totals: {
        activeClasses: active.length,
        students: active.reduce((n, c) => n + (counts.get(c.id) ?? 0), 0),
        teachers: teachers.length,
      },
    };
  });

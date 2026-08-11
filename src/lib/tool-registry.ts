/**
 * Single source of truth for every tool page inside the authenticated app.
 *
 * Used by:
 *  - /toolkit  — renders the tool cards, grouped by section, filtered by access
 *  - the app layout — breadcrumbs ("ארגז כלים › <section> › <tool>") and the
 *    access guard that hides a tool instead of rendering a broken screen
 *  - scripts/check-route-links.mjs — fails when a route has no entry here and
 *    is therefore unreachable from the in-app navigation (orphan route)
 */

export type ToolSection = "tools" | "sound" | "motivation" | "assess" | "docs" | "settings";

export const TOOL_SECTIONS: { id: ToolSection; label: string }[] = [
  { id: "tools", label: "כלים" },
  { id: "sound", label: "צלצולים וסאונד" },
  { id: "motivation", label: "מוטיבציה ופרסים" },
  { id: "assess", label: "הערכה ומבחנים" },
  { id: "docs", label: "מסמכים ותבניות" },
  { id: "settings", label: "הגדרות" },
];

export function sectionLabel(id: ToolSection): string {
  return TOOL_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

/** What a user must have in order for a tool to be usable at all. */
export type ToolRequirement = "any" | "classes" | "admin" | "admin_or_principal";

export type ToolEntry = {
  /** Route path, TanStack style (`$classId` for the dynamic segment). */
  to: string;
  label: string;
  desc: string;
  section: ToolSection;
  requires: ToolRequirement;
  /** True when the route needs a class id in the path. */
  classScoped?: boolean;
  /** Icon name from lucide-react, resolved by the UI. */
  icon: string;
};

export const TOOLS: ToolEntry[] = [
  // --- sound ---
  { to: "/bell-schedule", section: "sound", requires: "any", icon: "BellRing", label: "לוח צלצולים", desc: "תזמון פעמוני שיעור והפסקות לאורך היום" },
  { to: "/sound-board", section: "sound", requires: "any", icon: "Music", label: "ניהול סאונד ואפקטים", desc: "ספריית צלילים לפי קטגוריה ומיפוי אירועים במערכת לצליל" },
  { to: "/sound-test", section: "sound", requires: "any", icon: "Music", label: "בדיקת צלילים", desc: "השמעת כל הצלילים לבדיקת עוצמה ותקינות בדפדפן" },

  // --- tools ---
  { to: "/weekly-schedule/$classId", section: "tools", requires: "classes", classScoped: true, icon: "CalendarDays", label: "מערכת שעות", desc: "מערכת שבועית, תורנויות ולוח שנה עברי" },
  { to: "/student-view/$classId", section: "tools", requires: "classes", classScoped: true, icon: "Globe2", label: "מצב תלמיד", desc: "המסך כפי שהתלמיד רואה אותו — לבדיקה לפני שיתוף" },

  // --- motivation ---
  { to: "/gamification/$classId", section: "motivation", requires: "classes", classScoped: true, icon: "Trophy", label: "מבצעים וגמיפיקציה", desc: "נקודות, פרסים, מבצעים כיתתיים וטבלת מובילים" },
  { to: "/raffle/$classId", section: "motivation", requires: "classes", classScoped: true, icon: "Dices", label: "הגרלות", desc: "גלגל מזל אינטראקטיבי להגרלת תלמידים ופרסים" },
  { to: "/poll/$classId", section: "motivation", requires: "classes", classScoped: true, icon: "MessageSquare", label: "סקר כיתה חי", desc: "שאלה לכיתה עם תוצאות בזמן אמת" },

  // --- assess ---
  { to: "/questions", section: "assess", requires: "any", icon: "ClipboardList", label: "מאגר שאלות", desc: "בנק שאלות לפי נושא ומקצוע" },
  { to: "/insights", section: "assess", requires: "any", icon: "LineChart", label: "תובנות", desc: "מגמות ציונים, נוכחות והתנהגות" },
  { to: "/resources", section: "assess", requires: "any", icon: "Library", label: "ספריית חומרי הוראה", desc: "מערכי שיעור, דפי עבודה ועזרים" },
  { to: "/resources/generate", section: "assess", requires: "any", icon: "Wand2", label: "מחולל סיכומים ומשימות", desc: "הפקת סיכום או מערך משימות מתוך חומר שבספרייה" },
  { to: "/exam-generator/$classId", section: "assess", requires: "classes", classScoped: true, icon: "Wand2", label: "מחולל מבחנים AI", desc: "יצירת מבחן מותאם מהחומר שנלמד" },
  { to: "/exam-scanner/$classId", section: "assess", requires: "classes", classScoped: true, icon: "ScanText", label: "סורק מבחנים", desc: "ניקוד מבחנים סרוקים בעזרת AI" },
  { to: "/analytics/$classId", section: "assess", requires: "classes", classScoped: true, icon: "TrendingUp", label: "אנליטיקת כיתה", desc: "מגמות והתפלגות ציונים" },
  { to: "/pedagogical/$classId", section: "assess", requires: "classes", classScoped: true, icon: "Award", label: "דוח פדגוגי", desc: "תמונת מצב פדגוגית והפקת דוח" },

  // --- docs ---
  { to: "/settings/brand", section: "docs", requires: "any", icon: "Palette", label: "תבנית ומיתוג המוסד", desc: "לוגו, שם מוסד וכותרת קבועה — מוטמעים בכל מסמך שמופק" },
  { to: "/ingest", section: "docs", requires: "any", icon: "FileText", label: "העלאה חכמה", desc: "העלאת קבצים ושיבוץ אוטומטי של הנתונים" },
  { to: "/onboarding", section: "docs", requires: "any", icon: "Sparkles", label: "המדריך החכם", desc: "שישה שלבים מהקמת הכיתה ועד הדוח הראשון להורים" },
  { to: "/certificates/$classId", section: "docs", requires: "classes", classScoped: true, icon: "Award", label: "תעודות", desc: "הפקת תעודות עם התבנית והלוגו של המוסד" },
  { to: "/daily/$classId", section: "docs", requires: "classes", classScoped: true, icon: "FileText", label: "סיכום יומי", desc: "דוח יומי להדפסה ולשליחה" },
  { to: "/bulletins/$classId", section: "docs", requires: "classes", classScoped: true, icon: "FileText", label: "עלון שבועי", desc: "עלון כיתתי עם סיכום, חידה ופעילויות" },
  { to: "/reports/$classId", section: "docs", requires: "classes", classScoped: true, icon: "FileText", label: "דוחות", desc: "דוחות מעקב והתקדמות" },
  { to: "/parents/$classId", section: "docs", requires: "classes", classScoped: true, icon: "Mail", label: "קשר עם הורים", desc: "מיילים ותקשורת עם ההורים" },
  { to: "/share/$classId", section: "docs", requires: "classes", classScoped: true, icon: "Globe2", label: "שיתוף וקישורים", desc: "קישורי צפייה להורים ולעמוד הכיתה" },
  { to: "/calendar/$classId", section: "docs", requires: "classes", classScoped: true, icon: "CalendarDays", label: "לוח אירועים", desc: "אירועי כיתה, מבחנים וימי הולדת" },

  // --- settings ---
  { to: "/map", section: "settings", requires: "any", icon: "Map", label: "מפת המערכת", desc: "כל המסכים והכלים בעברית, בלחיצה אחת — מותאם לכיתה שלך" },
  { to: "/settings", section: "settings", requires: "any", icon: "Settings", label: "מרכז ההגדרות", desc: "אבטחה וקוד PIN, העדפות תזכורות, מיתוג המוסד ומצב המנוי" },
  { to: "/settings/theme", section: "settings", requires: "any", icon: "Palette", label: "ערכות נושא", desc: "תצוגה מקדימה ושמירה של ערכת הנושא — חלה בכל המכשירים" },
  { to: "/institution", section: "settings", requires: "admin_or_principal", icon: "Building2", label: "לוח המוסד", desc: "כיתות, מלמדים, צוות ונתוני המוסד" },
  { to: "/user-management", section: "settings", requires: "admin_or_principal", icon: "ShieldCheck", label: "ניהול משתמשים", desc: "הרשאות, בקשות גישה, מוסדות ותקופות ניסיון" },
];

/** Routes reachable from the app without a toolkit card (nav, class screens, details). */
export const NAV_EXEMPT_ROUTES = [
  "/toolkit",
  "/settings/$",
  "/classes",
  "/classes/$classId",
  "/classes/$classId/display",
  "/resources/$resourceId",
] as const;

export function toolByPath(path: string): ToolEntry | undefined {
  return TOOLS.find((t) => t.to === path);
}

/** Normalises a live pathname (`/analytics/abc-123`) to a registry path. */
export function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const exact = TOOLS.find((t) => t.to === clean);
  if (exact) return exact.to;
  const segments = clean.split("/");
  const match = TOOLS.find((t) => {
    const parts = t.to.split("/");
    if (parts.length !== segments.length) return false;
    return parts.every((p, i) => (p.startsWith("$") ? Boolean(segments[i]) : p === segments[i]));
  });
  return match?.to ?? clean;
}

export type ToolAccess = { hasClasses: boolean; isAdmin: boolean; isPrincipal: boolean };

export function canUseTool(entry: ToolEntry, access: ToolAccess | undefined): boolean {
  if (!access) return true; // unknown yet — don't flash a "no access" screen
  switch (entry.requires) {
    case "classes":
      return access.hasClasses || access.isAdmin || access.isPrincipal;
    case "admin":
      return access.isAdmin;
    case "admin_or_principal":
      return access.isAdmin || access.isPrincipal;
    default:
      return true;
  }
}

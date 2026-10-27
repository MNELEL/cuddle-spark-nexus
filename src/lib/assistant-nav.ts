/**
 * קטלוג המסכים שהעוזר יכול לפתוח. כל נתיב נבדק מול עץ הנתיבים של האפליקציה.
 * נתיב עם מזהה כיתה מקבל את הכיתה הנוכחית.
 */
export type NavTarget = { key: string; label: string; path: (classId: string) => string; about: string };

export const NAV_TARGETS: NavTarget[] = [
  { key: "class", label: "דף הכיתה", path: (id) => `/classes/${id}`, about: "דף הכיתה הראשי" },
  { key: "students", label: "רשימת התלמידים", path: (id) => `/classes/${id}?tab=students`, about: "תלמידים, חיפוש, מיון, הוספה, ייבוא וייצוא, קבוצות" },
  { key: "seating", label: "סידור הושבה", path: (id) => `/classes/${id}?tab=seating`, about: "מפת הכיתה, מיון חכם, תבניות, אילוצי ישיבה, סידורים שמורים" },
  { key: "dashboard", label: "דשבורד יומי", path: (id) => `/classes/${id}?tab=day`, about: "נוכחות ודירוג כל התלמידים בכל שעות היום, עריכת עמודות, הדפסה" },
  { key: "more", label: "עוד בדף הכיתה", path: (id) => `/classes/${id}?tab=more`, about: "תזכורות, נקודות, ציונים ויעדים, הקלטות שיעור, תאריכים עבריים, חומרי ספרייה" },
  { key: "weekly_schedule", label: "מערכת שבועית", path: (id) => `/weekly-schedule/${id}`, about: "מערכת שעות, תורנויות, כללים קבועים, חופשות" },
  { key: "pacing", label: "תכנון קצב שנתי", path: (id) => `/pacing/${id}`, about: "כמה להספיק בכל שבוע ובכל שיעור, חישוב, עריכה ואישור" },
  { key: "calendar", label: "לוח שנה", path: (id) => `/calendar/${id}`, about: "לוח שנה וחופשות של הכיתה" },
  { key: "bulletin", label: "עלון שבועי", path: (id) => `/bulletins/${id}`, about: "עלון להורים, ההספק הלימודי, דבר תורה, מכובדים" },
  { key: "daily_summary", label: "סיכום יומי", path: (id) => `/daily/${id}`, about: "סיכום יום ללימודים להדפסה ולהורים" },
  { key: "reports", label: "דוחות כיתה", path: (id) => `/reports/${id}`, about: "דוח תלמידים לטווח תאריכים" },
  { key: "classes", label: "כל הכיתות", path: () => "/classes", about: "רשימת הכיתות" },
  { key: "school", label: "בית הספר", path: () => "/school", about: "דף הבית של המוסד, כיתות ומלמדים" },
  { key: "institution", label: "דשבורד המוסד", path: () => "/institution", about: "למנהלים: כיתות, מלמדים, פגישות, לוח שנה, צוות" },
  { key: "toolkit", label: "ארגז כלים", path: () => "/toolkit", about: "כלי עזר כלליים" },
  { key: "resources", label: "ספריית חומרי הוראה", path: () => "/resources", about: "חומרי לימוד ומשאבים" },
  { key: "insights", label: "תובנות", path: () => "/insights", about: "תובנות כלליות על הכיתות" },
  { key: "ingest", label: "העלאה חכמה", path: () => "/ingest", about: "ייבוא תלמידים, קבצים, הקלטות" },
  { key: "contact_sheet", label: "דף קשר", path: () => "/contact-sheet", about: "אנשי קשר של המוסד" },
  { key: "weekly_sheet", label: "דף קשר שבועי להורים", path: () => "/weekly-sheet", about: "גיליון שבועי להורים: ההספק, מבחנים, הודעות" },
  { key: "bell_schedule", label: "לוח צלצולים", path: () => "/bell-schedule", about: "שעות הצלצולים" },
  { key: "settings", label: "הגדרות", path: () => "/settings", about: "הגדרות המערכת, מנוי, אבטחה, מיתוג" },
  { key: "user_management", label: "ניהול משתמשים", path: () => "/user-management", about: "בקשות הרשאה ותפקידים" },
  { key: "teacher_advisor", label: "יועץ למלמד", path: () => "/teacher-advisor", about: "ייעוץ פדגוגי לדילמות" },
];

export function findNavTarget(key: string): NavTarget | undefined {
  return NAV_TARGETS.find((t) => t.key === key);
}

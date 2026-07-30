/**
 * Shared definition of the printable "מבצעים" (reward campaign) charts.
 * Used by the blog guide, the on-screen print view and the PDF generator so
 * the screen, the printout and the PDF never drift apart.
 */
export type RewardChart = {
  id: string;
  name: string;
  goal: string;
  grid: string;
  reward: string;
  /** Column headers of the printable grid (right-to-left order). */
  columns: string[];
  /** Label of the first (row header) column, e.g. "שם התלמיד". */
  rowLabel: string;
  /** How many blank rows to print. */
  rows: number;
  orientation: "portrait" | "landscape";
};

export const REWARD_CHARTS: RewardChart[] = [
  {
    id: "mishna-daily",
    name: "לוח משנתי — 'משנה יומית'",
    goal: "חזרה יומית על משנה אחת בעל פה",
    grid: "טבלת 30 משבצות (חודש), משבצת = יום",
    reward: "10 משבצות = פרס קטן · 30 משבצות = פרס חודשי",
    rowLabel: "שם התלמיד",
    columns: Array.from({ length: 30 }, (_, i) => String(i + 1)),
    rows: 20,
    orientation: "landscape",
  },
  {
    id: "gemara-baal-peh",
    name: "לוח בעל פה בגמרא",
    goal: "אמירת קטע גמרא בעל פה בפני המלמד",
    grid: "עמודה לכל תלמיד, שורה לכל עמוד/סוגיה",
    reward: "כל 5 סימונים — נקודה לקבוצה, לא רק לתלמיד",
    rowLabel: "עמוד / סוגיה",
    columns: Array.from({ length: 12 }, (_, i) => `תלמיד ${i + 1}`),
    rows: 18,
    orientation: "landscape",
  },
  {
    id: "tefila-midot",
    name: "לוח מבצע תפילה ומידות",
    goal: "הגעה בזמן, עניית אמן, עזרה לחבר",
    grid: "טבלה שבועית 5 ימים × 3 קריטריונים",
    reward: "מצטבר לכיתה — יעד כיתתי משותף",
    rowLabel: "שם התלמיד",
    columns: ["א׳ בזמן", "א׳ אמן", "א׳ עזרה", "ב׳ בזמן", "ב׳ אמן", "ב׳ עזרה", "ג׳ בזמן", "ג׳ אמן", "ג׳ עזרה", "ד׳ בזמן", "ד׳ אמן", "ד׳ עזרה", "ה׳ בזמן", "ה׳ אמן", "ה׳ עזרה"],
    rows: 20,
    orientation: "landscape",
  },
  {
    id: "parasha",
    name: "לוח מבצע פרשת השבוע",
    goal: "חזרה בבית על הפרשה + חתימת הורה",
    grid: "משבצת אחת לשבוע, 12 שבועות בעמוד",
    reward: "הגרלה שבועית בין החותמים",
    rowLabel: "שם התלמיד",
    columns: Array.from({ length: 12 }, (_, i) => `שבוע ${i + 1}`),
    rows: 22,
    orientation: "portrait",
  },
  {
    id: "stairs",
    name: "לוח 'עולים במדרגות'",
    goal: "יעד אישי מדורג לכל תלמיד",
    grid: "סולם 10 שלבים אנכי לכל תלמיד",
    reward: "פרס בשלב 5 ובשלב 10 בלבד",
    rowLabel: "שם התלמיד",
    columns: Array.from({ length: 10 }, (_, i) => `שלב ${i + 1}`),
    rows: 22,
    orientation: "portrait",
  },
];

export function getRewardChart(id: string): RewardChart | undefined {
  return REWARD_CHARTS.find((c) => c.id === id);
}
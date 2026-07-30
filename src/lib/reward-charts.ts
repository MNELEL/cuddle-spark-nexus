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

/** Teacher-supplied tweaks applied on top of a built-in chart template. */
export type RewardChartCustomization = {
  /** Class name printed in the chart title / PDF meta line. */
  className: string;
  /** Teacher (מלמד) name printed in the signature line. */
  teacherName: string;
  /** How many day/step columns to print. */
  columnCount: number;
  /** How many blank student rows to print. */
  rows: number;
  /** Overrides the reward ladder text. Empty = keep the template text. */
  reward: string;
  /** Overrides the campaign goal text. Empty = keep the template text. */
  goal: string;
};

export const DEFAULT_REWARD_CHART_CUSTOMIZATION: RewardChartCustomization = {
  className: "",
  teacherName: "",
  columnCount: 0,
  rows: 0,
  reward: "",
  goal: "",
};

/**
 * Rebuilds column headers for a different column count, keeping the template's
 * labelling style: pure numbers stay numbers, prefixed labels ("שבוע 1") keep
 * their prefix, and free-form label lists are cycled.
 */
function buildColumns(chart: RewardChart, count: number): string[] {
  const first = chart.columns[0] ?? "1";
  if (/^[0-9]+$/.test(first)) return Array.from({ length: count }, (_, i) => String(i + 1));
  const prefixMatch = first.match(/^(.*?)\s*[0-9]+$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
  }
  return Array.from({ length: count }, (_, i) => chart.columns[i % chart.columns.length]);
}

/** Applies teacher customization to a template, returning a new chart object. */
export function applyRewardChartCustomization(
  chart: RewardChart,
  custom?: Partial<RewardChartCustomization>,
): RewardChart {
  if (!custom) return chart;
  const columnCount = Math.max(1, Math.min(40, custom.columnCount || chart.columns.length));
  const rows = Math.max(1, Math.min(40, custom.rows || chart.rows));
  return {
    ...chart,
    name: custom.className?.trim() ? `${chart.name} — ${custom.className.trim()}` : chart.name,
    goal: custom.goal?.trim() || chart.goal,
    reward: custom.reward?.trim() || chart.reward,
    columns: columnCount === chart.columns.length ? chart.columns : buildColumns(chart, columnCount),
    rows,
  };
}
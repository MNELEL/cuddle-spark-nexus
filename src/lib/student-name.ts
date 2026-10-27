/** תצוגת שם תלמיד: פרטי ואז משפחה (כמו שנשמר), או משפחה ואז פרטי. */
export type NameFormat = "first_last" | "last_first";

export const NAME_FORMAT_LABEL: Record<NameFormat, string> = {
  first_last: "שם פרטי ואז משפחה",
  last_first: "משפחה ואז שם פרטי",
};

type NameSource = { name?: string | null; first_name?: string | null; last_name?: string | null };

/** אותה חלוקה כמו במיון: שדות ייעודיים אם קיימים, אחרת המילה הראשונה והשאר. */
export function splitStudentName(s: NameSource): { first: string; last: string } {
  const parts = (s.name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = s.first_name?.trim() || parts[0] || "";
  const last = s.last_name?.trim() || (parts.length > 1 ? parts.slice(1).join(" ") : "");
  return { first, last };
}

export function formatStudentName(s: NameSource, format: NameFormat): string {
  const full = (s.name ?? "").trim();
  if (format === "first_last") return full;
  const { first, last } = splitStudentName(s);
  return last ? `${last} ${first}` : full;
}

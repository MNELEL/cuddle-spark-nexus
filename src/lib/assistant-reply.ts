/**
 * נירמול תשובת ה-AI של העוזר החכם + בניית קישורי מקורות.
 * לוגיקה טהורה כדי שאפשר לבדוק אותה אוטומטית בלי קריאה לשרת.
 */

export type AssistantMode = "read" | "write" | "clarify";

export type AssistantSourceLink = {
  label: string;
  /** נתיב מסך במערכת. "$classId" מוחלף בכיתה הפעילה. */
  to: string;
};

export type NormalizedReply<TAction> = {
  mode: AssistantMode;
  answer: string;
  actions: TAction[];
  clarify: string | null;
  clarifyOptions: string[];
  sources: string[];
};

export type RawReply<TAction = unknown> = {
  mode?: unknown;
  answer?: unknown;
  clarify?: unknown;
  clarifyOptions?: unknown[];
  sources?: unknown[];
  /** הפעולות הגולמיות אינן בשימוש בנירמול — הן מגיעות מאומתות ב-opts.actions. */
  actions?: unknown[];
  __action?: TAction;
};

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * קובע mode עקבי: כתיבה רק כשיש פעולות, הבהרה רק כשיש שאלה,
 * וכל השאר נחשב תשובת קריאה.
 */
export function normalizeAssistantReply<TAction>(
  raw: RawReply<TAction>,
  opts: { actions: TAction[]; fallbackSources?: string[] },
): NormalizedReply<TAction> {
  const actions = opts.actions;
  const clarify = isText(raw.clarify) ? raw.clarify.trim().slice(0, 300) : null;
  const clarifyOptions = (raw.clarifyOptions ?? [])
    .filter(isText)
    .slice(0, 4)
    .map((o) => o.trim().slice(0, 80));

  let mode: AssistantMode =
    raw.mode === "read" || raw.mode === "write" || raw.mode === "clarify"
      ? raw.mode
      : actions.length > 0
        ? "write"
        : "read";
  if (mode === "clarify" && !clarify) mode = actions.length > 0 ? "write" : "read";
  if (mode === "write" && actions.length === 0) mode = clarify ? "clarify" : "read";

  const sources = (raw.sources ?? []).filter(isText).slice(0, 6).map((s) => s.trim().slice(0, 120));
  if (mode === "read" && sources.length === 0) sources.push(...(opts.fallbackSources ?? []));

  return {
    mode,
    answer: isText(raw.answer) ? String(raw.answer) : clarify ? "" : "(אין תשובה)",
    actions: mode === "clarify" ? [] : actions,
    clarify: mode === "clarify" ? clarify : null,
    clarifyOptions: mode === "clarify" ? clarifyOptions : [],
    sources,
  };
}

const SOURCE_ROUTES: { match: RegExp; label: string; to: string }[] = [
  { match: /נוכחות|חיסור|נעדר|איחור/, label: "מסך הדוחות — נוכחות", to: "/reports/$classId" },
  { match: /ציון|מבחן|בחינה|ממוצע/, label: "מסך הניתוח — ציונים", to: "/analytics/$classId" },
  { match: /התנהגות|נקודות|פרס/, label: "מסך ההתנהגות והפרסים", to: "/gamification/$classId" },
  { match: /אירוע חריג|משמעת/, label: "סיכום יומי ומשמעת", to: "/daily/$classId" },
  { match: /לוח|אירוע|חג|תאריך/, label: "יומן הכיתה", to: "/calendar/$classId" },
  { match: /הודע|עדכון|בולטין|עלון/, label: "עדכונים והודעות", to: "/daily/$classId" },
  { match: /הור(ים|ה)|שיחה|קשר/, label: "קשר עם ההורים", to: "/parents/$classId" },
  { match: /תלמיד|רשימה|כיתה/, label: "רשימת התלמידים", to: "/classes/$classId" },
];

/** ממפה מקורות טקסטואליים לקישורים למסכים שבהם אפשר לאמת את המידע. */
export function buildSourceLinks(sources: string[]): AssistantSourceLink[] {
  const out: AssistantSourceLink[] = [];
  for (const s of sources) {
    for (const r of SOURCE_ROUTES) {
      if (!r.match.test(s)) continue;
      if (out.some((o) => o.to === r.to)) break;
      out.push({ label: r.label, to: r.to });
      break;
    }
  }
  return out.slice(0, 4);
}

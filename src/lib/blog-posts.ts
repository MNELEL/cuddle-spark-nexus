/**
 * Canonical registry of published blog posts.
 * Single source of truth for the RSS feed, JSON-LD and social share images.
 * Keep in sync with src/routes/blog.*.tsx and the sitemap route.
 */
import ogSeating from "@/assets/og/ai-seating-arrangements-guide.jpg.asset.json";
import ogClassdojo from "@/assets/og/classdojo-comparison.jpg.asset.json";
import ogChecklist from "@/assets/og/classroom-management-strategies-checklist.jpg.asset.json";
import ogStrategies from "@/assets/og/classroom-management-strategies.jpg.asset.json";
import ogTools from "@/assets/og/classroom-tools-teachers.jpg.asset.json";
import ogHallPass from "@/assets/og/digital-hall-pass-guide.jpg.asset.json";
import ogFreeTools from "@/assets/og/free-tools-comparison.jpg.asset.json";
import ogParasha from "@/assets/og/parasha-report-templates.jpg.asset.json";
import ogProgress from "@/assets/og/progress-tracking-guide.jpg.asset.json";
import ogRewards from "@/assets/og/torah-study-reward-charts.jpg.asset.json";
import ogWeekly from "@/assets/og/weekly-report-template.jpg.asset.json";
import ogBlogIndex from "@/assets/og/blog-index.jpg.asset.json";
import { SITE_URL } from "@/lib/site-meta";

export type BlogPost = {
  /** Path relative to the site root, e.g. "/blog/progress-tracking-guide". */
  path: string;
  title: string;
  description: string;
  /** ISO date used for RSS pubDate and JSON-LD datePublished. */
  published: string;
  /** Absolute https URL of the post's share image. */
  image: string;
};

const abs = (p: { url: string }) => `${SITE_URL}${p.url}`;

export const BLOG_INDEX_IMAGE = abs(ogBlogIndex);

export const BLOG_POSTS: BlogPost[] = [
  {
    path: "/blog/classroom-management-strategies",
    title: "אסטרטגיות ניהול כיתה — מדריך למלמד ורב בתלמוד תורה",
    description:
      "מדריך מקצועי לניהול כיתה במגזר החרדי: תגבור התנהגות חיובית, עיצוב סביבת למידה, מעקב פדגוגי מבוסס נתונים ושגרות שמייצרות שקט אמיתי בכיתה.",
    published: "2026-05-04",
    image: abs(ogStrategies),
  },
  {
    path: "/blog/classroom-management-strategies/checklist",
    title: "צ'קליסט ניהול כיתה בתלמוד תורה — PDF להורדה חינם",
    description:
      "צ'קליסט מקצועי (PDF) עם 5 אסטרטגיות ניהול כיתה + מעקב שבועי למלמד. הרשמה קצרה ותוריד מיד עם מיתוג הכיתה שלי.",
    published: "2026-05-11",
    image: abs(ogChecklist),
  },
  {
    path: "/blog/progress-tracking-guide",
    title: "מעקב התקדמות תלמידים — מדריך מלא לרבנים ומלמדים",
    description:
      "איך לבנות מערכת מעקב התקדמות תלמידים בתלמוד תורה: יעדים, אינדיקטורים, דוחות שבועיים ושיחות עם הורים — עם דוגמאות מעשיות.",
    published: "2026-05-19",
    image: abs(ogProgress),
  },
  {
    path: "/blog/weekly-report-template",
    title: "תבנית דו״ח שבועי לתלמיד — להורדה ולשימוש בכיתה",
    description:
      "תבנית דו״ח שבועי מוכנה לתלמודי תורה: שדות למעקב לימודי, התנהגותי ורוחני, עם דוגמאות מלאות ופורמט להדפסה או שליחה להורים.",
    published: "2026-05-27",
    image: abs(ogWeekly),
  },
  {
    path: "/blog/classroom-tools-teachers",
    title: "10 כלי הוראה חינמיים שכל מלמד חייב להכיר",
    description:
      "רשימה מקצועית של כלי הוראה מודרניים — הגרלות בכיתה, יצירת קבוצות, מבחנים אוטומטיים ומעקב התקדמות — עם הסברים והמלצות שימוש.",
    published: "2026-06-03",
    image: abs(ogTools),
  },
  {
    path: "/blog/free-tools-comparison",
    title: "השוואת כלי ניהול כיתה חינמיים למלמדים בתלמודי תורה",
    description:
      "מדריך השוואה מעשי בין כלים חינמיים לניהול כיתה במגזר החרדי — פנקס ידני, גיליון אקסל וכלים דיגיטליים ייעודיים. יתרונות, חסרונות והמלצה לכל שלב.",
    published: "2026-06-15",
    image: abs(ogFreeTools),
  },
  {
    path: "/blog/classdojo-comparison",
    title: "ClassDojo מול הכיתה שלי — השוואה למלמדים בתלמודי תורה",
    description:
      "ClassDojo מול הכיתה שלי: השוואה למלמדים בתלמודי תורה וחיידרים — עברית, מקצועות קודש, פרטיות ודו״חות פדגוגיים.",
    published: "2026-06-24",
    image: abs(ogClassdojo),
  },
  {
    path: "/blog/digital-hall-pass-guide",
    title: "ניהול אישורי יציאה דיגיטליים בתלמוד תורה — מדריך מלא",
    description:
      "מדריך לרבנים ומנהלי תלמודי תורה: איך מערכת אישורי יציאה דיגיטלית מצמצמת הפרעות, שומרת על סדר וביטחון, ומחליפה את eHallPass.",
    published: "2026-07-02",
    image: abs(ogHallPass),
  },
  {
    path: "/blog/ai-seating-arrangements-guide",
    title: "סידורי ישיבה חכמים עם AI — מדריך ניהול כיתה גדולה בחיידר",
    description:
      "מדריך מקצועי למלמדים ורבנים: איך להשתמש ב-AI Sort לבניית סידורי ישיבה שמפחיתים הפרעות ומשפרים ריכוז בכיתה גדולה בתלמוד תורה, במקום עבודה ידנית.",
    published: "2026-07-14",
    image: abs(ogSeating),
  },
  {
    path: "/blog/torah-study-reward-charts",
    title: "לוח מבצעים ופרסים לתלמידים — מדריך ותבניות להדפסה",
    description:
      "מדריך מלא להפעלת מבצעי לימוד בתלמוד תורה: לוחות מבצעים להדפסה, שיטות ניקוד, סולם פרסים לפי גיל ומעבר חלק מלוח נייר למעקב דיגיטלי בעברית.",
    published: "2026-07-23",
    image: abs(ogRewards),
  },
  {
    path: "/blog/parasha-report-templates",
    title: "תבניות דפי קשר ודו״ח שבועי לפרשת השבוע — להדפסה",
    description:
      "ספריית תבניות מוכנות להדפסה לדו״ח שבועי ולדף קשר על פרשת השבוע בתלמוד תורה — לפי גילאים, עם נוסח מוכן למלמד ולרב ואפשרות הפקה אוטומטית כ-PDF.",
    published: "2026-07-31",
    image: abs(ogParasha),
  },
];

/** Newest first — used by the RSS feed. */
export const blogPostsNewestFirst = (): BlogPost[] =>
  [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));

export const findBlogPost = (path: string): BlogPost | undefined =>
  BLOG_POSTS.find((p) => p.path === path);

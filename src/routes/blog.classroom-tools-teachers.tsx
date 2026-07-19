import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/classroom-tools-teachers";
const TITLE = "10 כלי הוראה חינמיים שכל מלמד חייב להכיר";
const DESCRIPTION =
  "רשימה מקצועית של כלי הוראה מודרניים — הגרלות בכיתה, יצירת קבוצות, מבחנים אוטומטיים ומעקב התקדמות — עם הסברים והמלצות שימוש.";

const TOOLS = [
  { name: "מחולל קבוצות", desc: "יוצר קבוצות עבודה מאוזנות תוך שנייה — לפי רמה או אקראי.", link: "/tools/group-maker" },
  { name: "גלגל הגרלה", desc: "בוחר תלמיד אקראי לענות, עם אנימציה שהתלמידים אוהבים.", link: "/" },
  { name: "לוח סאונדים", desc: "צלילים לתגובה מהירה בכיתה — אישור, שקט, שאלה, עידוד.", link: "/sound-board" },
  { name: "מחסן שאלות", desc: "בנק שאלות שאפשר לסנן לפי נושא ולייצא כמבחן PDF.", link: "/questions" },
  { name: "מעקב התקדמות", desc: "לוח מחוונים עם גרפים לכל תלמיד — מעדכן את עצמו בכל הזנה.", link: "/blog/progress-tracking-guide" },
  { name: "אישור יציאה דיגיטלי", desc: "מחליף את הפתק הישן — יודע מי יצא, מתי, ולכמה זמן.", link: "/blog/digital-hall-pass-guide" },
  { name: "יצוא PDF לרשימות", desc: "רשימת תלמידים, קבוצות, ציונים — הכל להדפסה מקצועית.", link: "/" },
  { name: "העלאה חכמה", desc: "מעלים צילום דף ציונים כתוב יד, והמערכת מזהה ומזינה אוטומטית.", link: "/ingest" },
  { name: "דו״ח יומי", desc: "סיכום אוטומטי של יום הלימודים — נוכחות, אירועים, הישגים.", link: "/" },
  { name: "טבלת ליידרבורד", desc: "טבלת ניקוד כיתתית וקבוצתית — מוטיבציה בריאה לתלמידים.", link: "/" },
];

export const Route = createFileRoute("/blog/classroom-tools-teachers")({
  component: Article,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: TITLE,
          inLanguage: "he",
          itemListElement: TOOLS.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.name,
            description: t.desc,
          })),
        }),
      },
    ],
  }),
});

function Article() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">→ חזרה לבלוג</Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-invert max-w-none [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-4 [&_p]:leading-relaxed">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{TITLE}</h1>
          <p className="mt-4 text-muted-foreground">
            אוסף כלים דיגיטליים מודרניים למלמדים, רבנים ומורים — כל אחד מהם חוסך זמן,
            משדרג את חוויית הלמידה, ולא דורש התקנה מסובכת.
          </p>

          <ol className="mt-8 space-y-6">
            {TOOLS.map((t, i) => (
              <li key={t.name} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <h3 className="text-xl font-semibold">
                  {i + 1}. {t.name}
                </h3>
                <p className="mt-2 text-muted-foreground">{t.desc}</p>
                <Link to={t.link} className="mt-3 inline-block text-sm text-primary hover:underline">
                  לפרטים ולהתנסות ←
                </Link>
              </li>
            ))}
          </ol>

          <h2>איך בוחרים מאיפה להתחיל?</h2>
          <p>
            עצה פרקטית — התחל מכלי אחד שפותר לך בעיה בוערת. אם רשימת הנוכחות נהיית
            כאב ראש, התחל ממערכת המעקב. אם הכיתה רועשת בעת חלוקת קבוצות, נסה את מחולל
            הקבוצות. אחרי שבועיים של שימוש קבוע, הוסף כלי נוסף.
          </p>
          <p>
            כל הכלים ברשימה קיימים ב-
            <Link to="/" className="text-primary hover:underline"> ClassAlign Studio</Link>{" "}
            כמערכת אחת מסונכרנת — כדי שלא תצטרך לזכור עשר סיסמאות ולעבור בין עשר לשוניות.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה לראות את כל הכלים במקום אחד?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              התנסה ב-ClassAlign Studio ←
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
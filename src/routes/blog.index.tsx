import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "בלוג ClassAlign · מאמרים ומדריכים לתלמודי תורה" },
      {
        name: "description",
        content:
          "מדריכים מקצועיים לרבנים, מלמדים ומנהלי תלמודי תורה — ניהול כיתה, מעקב פדגוגי, וכלים דיגיטליים בגובה העיניים.",
      },
      { property: "og:title", content: "בלוג ClassAlign · מאמרים ומדריכים לתלמודי תורה" },
      {
        property: "og:description",
        content:
          "מדריכים מקצועיים לרבנים, מלמדים ומנהלי תלמודי תורה — ניהול כיתה, מעקב פדגוגי וכלים דיגיטליים.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/blog" },
    ],
    links: [{ rel: "canonical", href: "https://cuddle-spark-nexus.lovable.app/blog" }],
  }),
});

function BlogIndex() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה לדף הבית
          </Link>
          <span className="text-sm font-semibold">בלוג ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">מאמרים ומדריכים</h1>
        <p className="mt-3 text-muted-foreground">
          תוכן מקצועי לרבנים, מלמדים ומנהלי תלמודי תורה — בגובה העיניים.
        </p>
        <ul className="mt-10 space-y-6">
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/progress-tracking-guide" className="block">
              <h2 className="text-xl font-semibold">מעקב התקדמות תלמידים — מדריך מלא</h2>
              <p className="mt-2 text-muted-foreground">
                איך לבנות מערכת מעקב שיטתית: יעדים, אינדיקטורים, דוחות שבועיים ושיחות
                הורים מבוססות נתונים.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/weekly-report-template" className="block">
              <h2 className="text-xl font-semibold">תבנית דו״ח שבועי לתלמיד</h2>
              <p className="mt-2 text-muted-foreground">
                תבנית מוכנה להעתקה עם דוגמה מלאה — לימודי קודש, מידות, מטרות שבועיות
                ופורמט להדפסה או שליחה בוואטסאפ.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">לתבנית ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/classroom-tools-teachers" className="block">
              <h2 className="text-xl font-semibold">10 כלי הוראה חינמיים שכל מלמד חייב</h2>
              <p className="mt-2 text-muted-foreground">
                רשימה מקצועית של כלים מודרניים לניהול כיתה — הגרלות, קבוצות, מבחנים
                אוטומטיים ומעקב התקדמות.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">לרשימה ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/digital-hall-pass-guide" className="block">
              <h2 className="text-xl font-semibold">ניהול אישורי יציאה דיגיטליים</h2>
              <p className="mt-2 text-muted-foreground">
                חלופה ידידותית ל-eHallPass — איך "הפתק" הישן מתחלף במערכת מסודרת
                בתלמוד תורה.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
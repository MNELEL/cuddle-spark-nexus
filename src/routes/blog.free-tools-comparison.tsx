import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/free-tools-comparison";
const TITLE = "השוואת כלי ניהול כיתה חינמיים למלמדים בתלמודי תורה";
const DESCRIPTION =
  "מדריך השוואה מעשי בין כלים חינמיים לניהול כיתה במגזר החרדי — פנקס ידני, גיליון אקסל וכלים דיגיטליים ייעודיים. יתרונות, חסרונות והמלצה לכל שלב.";

const ROWS = [
  {
    name: "פנקס נייר ידני",
    pros: ["ללא צורך במכשיר", "פשוט להתחלה", "מוכר לכל מלמד"],
    cons: ["אין גיבוי אם אובד", "קשה להפיק דו״ח להורים", "חישוב ציונים ידני וטועה"],
    best: "מלמד שרק מתחיל, כיתה קטנה של עד 12 תלמידים",
  },
  {
    name: "גיליון Google Sheets / Excel",
    pros: ["חינמי לחלוטין", "גיבוי בענן", "נוסחאות ממוצע אוטומטיות"],
    cons: ["דורש בניית תבנית בעצמך", "אין ממשק לתלמידים / הורים", "אין הגרלות / קבוצות / סאונדים"],
    best: "מלמד טכני שאוהב להתאים לעצמו, אבל בלי צורך בפיצ׳רים חכמים",
  },
  {
    name: "אפליקציות כלליות (Class Dojo וכד׳)",
    pros: ["ממשק נעים", "פיצ׳רים חברתיים"],
    cons: ["ממשק אנגלי — לא מותאם לחיידר", "אין תמיכה בקודש (גמרא, משנה, חומש)", "פרטיות מעורפלת"],
    best: "לא מומלץ לתלמודי תורה — התאמה תרבותית חסרה",
  },
  {
    name: "ClassAlign Studio (חינמי במסלול הבסיסי)",
    pros: [
      "עברית מלאה וימין־לשמאל",
      "מקצועות קודש כברירת מחדל",
      "מחולל קבוצות, גלגל הגרלה, סאונדים, מבחנים אוטומטיים",
      "מותאם למלמד ולרב",
    ],
    cons: ["דורש חיבור אינטרנט להפעלה ראשונית"],
    best: "מלמד רציני שמנהל כיתה שלמה ורוצה הכל במקום אחד",
  },
];

export const Route = createFileRoute("/blog/free-tools-comparison")({
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
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          inLanguage: "he",
          mainEntityOfPage: URL,
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
            כשמלמד בחיידר או בתלמוד תורה מחפש כלי ניהול כיתה חינמי, רוב הרשימות באינטרנט
            מציעות כלים אמריקאיים באנגלית — ללא התאמה לעברית, לא לימין־לשמאל, ובלי מקצועות
            הקודש. במדריך הזה נשווה חלופות אמיתיות שמלמד יכול להתחיל להשתמש בהן היום, בחינם.
          </p>

          <div className="mt-8 space-y-6">
            {ROWS.map((r) => (
              <section key={r.name} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <h2 className="!mt-0 text-xl font-semibold">{r.name}</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-emerald-500">יתרונות</div>
                    <ul className="mt-1 list-disc pr-4 text-sm text-muted-foreground">
                      {r.pros.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-destructive">חסרונות</div>
                    <ul className="mt-1 list-disc pr-4 text-sm text-muted-foreground">
                      {r.cons.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-sm"><span className="font-semibold">מתאים ל:</span> {r.best}</p>
              </section>
            ))}
          </div>

          <h2>המלצת שימוש: לשלב בין שניים</h2>
          <p>
            רוב המלמדים שאנחנו עובדים איתם מתחילים משילוב של פנקס נייר לרישום מיידי ליד השולחן,
            יחד עם{" "}
            <Link to="/" className="text-primary hover:underline">ClassAlign Studio</Link>{" "}
            לניהול המרכזי — ציונים, מעקב התנהגות, קבוצות והדפסת דו״חות להורים. הפנקס לא נעלם,
            אבל ההיסטוריה, החישובים והדו״חות נשמרים דיגיטלית בלי מאמץ נוסף.
          </p>

          <h2>מאיפה מתחילים בחינם?</h2>
          <p>
            אפשר להתחיל בלי כרטיס אשראי, לפתוח כיתה אחת, להזין תלמידים ולנסות את המחולל קבוצות
            והגלגל הגרלה. הכלים החינמיים כוללים גם ייצוא PDF של רשימת התלמידים ודו״ח יומי בסיסי.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה לנסות בחינם?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה ראשונה ב-ClassAlign ←
            </Link>
          </div>

          <h2 className="!mt-12">מדריכים נוספים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/classroom-tools-teachers" className="text-primary hover:underline">10 כלי הוראה חינמיים שכל מלמד חייב להכיר</Link></li>
            <li><Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">מדריך למעקב אחר התקדמות תלמידים</Link></li>
            <li><Link to="/blog/weekly-report-template" className="text-primary hover:underline">תבנית דו״ח שבועי להורים</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}
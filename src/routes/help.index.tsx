import { createFileRoute, Link } from "@tanstack/react-router";

const BASE = "https://cuddle-spark-nexus.lovable.app";
const URL = `${BASE}/help`;
const TITLE = "מרכז העזרה של ClassAlign — מדריכים ושאלות נפוצות";
const DESCRIPTION =
  "מרכז העזרה של ClassAlign Studio: מדריכים מעשיים להגדרת מעקב ציונים, נוכחות, קבוצות ודוחות — עם שאלות ותשובות, ידידותי למובייל ולקישור מפורטלי ידע.";

export const ARTICLES = [
  {
    slug: "setup-grade-tracking",
    title: "איך להגדיר מעקב ציונים בכיתה שלך",
    excerpt: "מדריך שלב-אחר-שלב: יצירת כיתה, הוספת תלמידים, קליטת ציונים ידנית או מתמונה, וצפייה בדוחות.",
  },
  {
    slug: "grading-scale-and-weights",
    title: "סולם ציונים ומשקלות בין מקצועות",
    excerpt: "איך לבחור סולם 1-5 או 0-100, לקבוע משקל למבחנים ולהכנה שבועית, ולהבין את הממוצע המשוקלל.",
  },
  {
    slug: "import-grades-from-image",
    title: "קליטת ציונים מתמונה או קול",
    excerpt: "העלאת צילום של דף ציונים או הקלטה קולית — הבינה המלאכותית מוציאה שם ותוצאה לבדיקה מהירה.",
  },
  {
    slug: "weekly-reports",
    title: "דוחות שבועיים ושליחה להורים",
    excerpt: "בניית דוח שבועי, ייצוא PDF, שיתוף לינק ציבורי אנונימי, ושליחה מסודרת דרך וואטסאפ או מייל.",
  },
  {
    slug: "mobile-usage",
    title: "שימוש במובייל וב-Android",
    excerpt: "כל התכונות עובדות מהטלפון — כולל אפליקציית Android להתקנה מקומית ועבודה offline לחלק מהמסכים.",
  },
  {
    slug: "privacy-and-pin",
    title: "אבטחה, PIN ופרטיות תלמידים",
    excerpt: "נעילת האפליקציה ב-PIN, מדיניות שיתוף, ואיך הדף הציבורי חושף רק נתונים מצטברים ואנונימיים.",
  },
];

const FAQ = [
  {
    q: "כמה זמן לוקח להגדיר מעקב ציונים לכיתה חדשה?",
    a: "בערך 10 דקות: יצירת הכיתה, ייבוא רשימת תלמידים (מ-Excel, PDF או צילום), ובחירת המקצועות. אחרי זה קליטת הציונים היא עניין של שניות בכל שיעור.",
  },
  {
    q: "האם אפשר לעבוד מהטלפון בזמן השיעור?",
    a: "כן. הממשק מותאם למובייל, כולל מסכי מגע גדולים לקליטת ציונים ונקודות התנהגות. יש גם אפליקציית Android להתקנה.",
  },
  {
    q: "האם המערכת חושפת שמות של תלמידים החוצה?",
    a: "לא. דף הכיתה הציבורי מציג רק ממוצעים מצטברים ועלונים — ללא שמות. ההורים רואים רק את הדו״ח של הילד שלהם.",
  },
  {
    q: "האם אני יכול לקשר למרכז העזרה מהאתר של בית הספר?",
    a: "כן. כל מאמר וכל שאלה במרכז העזרה הם URL קבוע (כולל עוגן לכותרת פנימית) — מתאים לקישור מפורטלי ידע, ויקי בית ספרי או קבוצת מלמדים.",
  },
  {
    q: "מה קורה אם שכחתי את ה-PIN?",
    a: "צא מהחשבון מהמסך הראשי, התחבר מחדש דרך המייל, ובהגדרות → אבטחה תוכל להגדיר PIN חדש.",
  },
];

export const Route = createFileRoute("/help/")({
  component: HelpIndex,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: "he",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: TITLE,
          inLanguage: "he",
          itemListElement: ARTICLES.map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${BASE}/help/${a.slug}`,
            name: a.title,
          })),
        }),
      },
    ],
  }),
});

function slugifyAnchor(text: string) {
  return text.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 60);
}

function HelpIndex() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">→ ClassAlign</Link>
          <span className="text-sm font-semibold">מרכז עזרה</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">מרכז העזרה של ClassAlign</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          מדריכים קצרים, ברורים ומעשיים — מעקב ציונים, נוכחות, קבוצות ודוחות. כל מאמר יש
          לו קישור קבוע (כולל עוגן לכל כותרת פנימית), מתאים לשילוב בפורטלי ידע ובוויקי
          של תלמודי תורה ובתי ספר.
        </p>

        <section aria-labelledby="articles" className="mt-10">
          <h2 id="articles" className="text-xl font-semibold sm:text-2xl">מדריכים</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ARTICLES.map((a) => (
              <li key={a.slug} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <Link to="/help/$slug" params={{ slug: a.slug }} className="block">
                  <h3 className="text-base font-semibold sm:text-lg">{a.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{a.excerpt}</p>
                  <span className="mt-3 inline-block text-sm text-primary">קרא ←</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="mt-12">
          <h2 id="faq" className="text-xl font-semibold sm:text-2xl">שאלות ותשובות</h2>
          <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
            {FAQ.map((f) => {
              const id = `q-${slugifyAnchor(f.q)}`;
              return (
                <details key={f.q} id={id} className="group p-5 open:bg-card/60">
                  <summary className="flex cursor-pointer items-start justify-between gap-3 text-base font-medium">
                    <span>
                      <a href={`#${id}`} className="text-muted-foreground hover:text-foreground ms-1" aria-label="קישור לשאלה">#</a>
                      {f.q}
                    </span>
                    <span className="text-muted-foreground transition group-open:rotate-180">⌄</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </details>
              );
            })}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-lg font-semibold">לא מצאת תשובה?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            כתוב לנו ל-<a className="text-primary hover:underline" href="mailto:nm0527603669@gmail.com">nm0527603669@gmail.com</a>
            {" "}או עבור ל<Link to="/support" className="text-primary hover:underline">עמוד התמיכה</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
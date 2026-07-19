import { createFileRoute, Link } from "@tanstack/react-router";

const BASE = "https://cuddle-spark-nexus.lovable.app";
const URL = `${BASE}/parents-guide`;
const TITLE = "מרכז המשאבים להורים · ClassAlign";
const DESCRIPTION =
  "דפי הסבר קצרים להורים על הדוח השבועי, סולם הציונים, מערכת הנקודות והמעקב הפדגוגי — מוכנים לקישור מדף הכיתה או מקבוצת הוואטסאפ.";

const GUIDES = [
  {
    slug: "weekly-report",
    title: "איך לקרוא את הדוח השבועי של הילד",
    excerpt: "מה משמעות כל שדה בדוח, איך להשוות בין שבועות, ומתי כדאי לפנות לרב.",
  },
  {
    slug: "grading-scale",
    title: "סולם הציונים 1-5 שאנחנו משתמשים בו",
    excerpt: "הסבר על ההבדל בין 3 ל-4, למה אין ציון 100, ואיך זה עוזר לילד להתקדם.",
  },
  {
    slug: "behavior-points",
    title: "מערכת נקודות ההתנהגות והפרסים",
    excerpt: "איך נקודות ניתנות, מה נחשב ׳מידה טובה׳, ואיך לתמוך במוטיבציה גם בבית.",
  },
  {
    slug: "supporting-progress-at-home",
    title: "איך לתמוך בהתקדמות הילד מהבית",
    excerpt: "טיפים פרקטיים למבחן חוזר, לחזרה על גמרא ולשגרת ערב שעובדת.",
  },
];

export const Route = createFileRoute("/parents-guide/")({
  component: Index,
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
          "@type": "ItemList",
          name: TITLE,
          inLanguage: "he",
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${BASE}/parents-guide/${g.slug}`,
            name: g.title,
          })),
        }),
      },
    ],
  }),
});

function Index() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">→ ClassAlign</Link>
          <span className="text-sm font-semibold">מרכז הורים</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">מרכז המשאבים להורים</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          דפי הסבר קצרים ומכובדים — כתובים בשפה ברורה, ללא מונחים מקצועיים. מלמדים
          מוזמנים לקשר לדפים האלו מדף הכיתה, מהעלון השבועי או מקבוצת ההורים.
        </p>
        <ul className="mt-10 space-y-4">
          {GUIDES.map((g) => (
            <li key={g.slug} className="rounded-2xl border border-border/60 bg-card/40 p-6">
              <Link to="/parents-guide/$slug" params={{ slug: g.slug }} className="block">
                <h2 className="text-xl font-semibold">{g.title}</h2>
                <p className="mt-2 text-muted-foreground">{g.excerpt}</p>
                <span className="mt-3 inline-block text-sm text-primary">קרא ←</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
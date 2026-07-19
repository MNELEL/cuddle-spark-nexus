import { createFileRoute, Link, notFound } from "@tanstack/react-router";

const BASE = "https://cuddle-spark-nexus.lovable.app";

type Guide = {
  title: string;
  description: string;
  updated: string;
  sections: { h: string; p: string | string[] }[];
  faq: { q: string; a: string }[];
};

const GUIDES: Record<string, Guide> = {
  "weekly-report": {
    title: "איך לקרוא את הדוח השבועי של הילד",
    description:
      "מדריך הורים קצר להבנת הדוח השבועי מבית הספר: מה כל שדה אומר, איך משווים בין שבועות ומתי לפנות לרב.",
    updated: "2026-07-01",
    sections: [
      {
        h: "מה יש בדוח",
        p: [
          "כותרת עם שם הכיתה והתאריכים המדויקים של השבוע.",
          "טור ׳לימודים׳ — התקדמות במקצועות הקודש (גמרא, משנה, חומש) ובחול.",
          "טור ׳מידות׳ — הערות חיוביות והתמדה, לא ציון התנהגות.",
          "הערה אישית מהרב — פסקה קצרה בסוף הדוח.",
        ],
      },
      {
        h: "איך משווים בין שבועות",
        p: "הדוח השבועי לא נועד להשוות ילדים ביניהם, אלא להראות את הילד ביחס לעצמו. שווה להסתכל על מגמה של 3-4 שבועות ולא על שבוע בודד.",
      },
      {
        h: "מתי לפנות לרב",
        p: "אם רואים ירידה עקבית של שלושה שבועות, אם ההערה האישית מזכירה משהו לא ברור, או פשוט כשרוצים לתאם ציפיות — לפנות לרב במייל או בטלפון הרשום בראש הדוח.",
      },
    ],
    faq: [
      {
        q: "מה ההבדל בין ׳חסר׳ ל-׳לא הוגש׳?",
        a: "׳חסר׳ הוא שיעור שהילד לא היה בו. ׳לא הוגש׳ הוא מטלה שהתבקשה ולא נמסרה. שניהם ניתנים להשלמה.",
      },
      {
        q: "האם הדוח נשלח גם לרב הראשי?",
        a: "לא. הדוח נשמר בכיתה בלבד ונשלח רק להורים ולרב המחנך.",
      },
    ],
  },
  "grading-scale": {
    title: "סולם הציונים 1-5",
    description:
      "הסבר להורים על סולם 1-5 שבו משתמשים בכיתה: מה משמעות כל מספר, למה בחרנו בסולם קצר, ואיך זה עוזר לילד.",
    updated: "2026-07-01",
    sections: [
      {
        h: "המשמעות של כל מספר",
        p: [
          "5 — שליטה מלאה, יכול ללמד חבר.",
          "4 — הבנה טובה עם דיוקים קטנים.",
          "3 — הבנה בסיסית, צריך חזרה מכוונת.",
          "2 — התחלה — צריך ליווי בבית או בשיעור פרטני.",
          "1 — עוד לא הגענו לחומר.",
        ],
      },
      {
        h: "למה לא 100",
        p: "סולם קצר גורם לילד ולהורה לראות התקדמות אמיתית ולא ברווח של 2 נקודות. גם קל יותר לרב לתת משוב הוגן.",
      },
    ],
    faq: [
      { q: "האם 3 זה ציון גרוע?", a: "לא. 3 זה ציון של ילד שהבין את החומר ברמה הבסיסית. זה נקודת פתיחה טובה." },
      { q: "איך עוברים מ-3 ל-4?", a: "בדרך כלל בעזרת חזרה קצרה של 10 דקות מספר פעמים בשבוע — לא ׳מרתון׳ ארוך." },
    ],
  },
  "behavior-points": {
    title: "מערכת נקודות המידות",
    description:
      "איך פועלת מערכת הנקודות בכיתה — על מה נותנים נקודה, מה הפרסים, ואיך תומכים במוטיבציה בבית בלי לחץ.",
    updated: "2026-07-01",
    sections: [
      {
        h: "על מה נותנים נקודה",
        p: [
          "עזרה לחבר בלי שביקשו.",
          "הגעה בזמן שלושה ימים ברצף.",
          "חזרה על משנה או פרק גמרא ביוזמה.",
          "התנצלות אמיתית אחרי טעות.",
        ],
      },
      {
        h: "הפרסים",
        p: "נקודות נצברות ומתחלפות בפרסים סמליים בסוף כל שבועיים — הפסקה נוספת, בחירת ניגון לתפילה, או ספר קטן. אין פרסים כספיים.",
      },
      {
        h: "תמיכה בבית",
        p: "כדאי לשאול את הילד ׳מה עשית היום שהיה נחמד לחבר?׳ במקום ׳כמה נקודות קיבלת?׳. זה שומר על המוטיבציה מבפנים.",
      },
    ],
    faq: [
      { q: "האם מורידים נקודות?", a: "לא. המערכת רק צוברת. חוסר נקודה זה מספיק משוב." },
    ],
  },
  "supporting-progress-at-home": {
    title: "איך לתמוך בהתקדמות מהבית",
    description:
      "טיפים פרקטיים להורים: שגרת ערב, הכנה למבחן חוזר, וחזרה על גמרא בלי מריבות.",
    updated: "2026-07-01",
    sections: [
      {
        h: "שגרת ערב שעובדת",
        p: [
          "זמן קבוע — אותה שעה כל יום.",
          "מקום קבוע — שולחן פנוי, בלי טלפון.",
          "פרק זמן קצר — 20-25 דקות מקסימום לילד צעיר.",
          "סיום חיובי — משפט אחד של עידוד, לא ביקורת על הטעויות.",
        ],
      },
      {
        h: "הכנה למבחן חוזר",
        p: "מבחן חוזר הוא הזדמנות, לא עונש. עוברים על הטעויות של המבחן הקודם, מבינים למה טעה, ופותרים 3 שאלות דומות בעצמו.",
      },
      {
        h: "חזרה על גמרא",
        p: "לפני החזרה — כוס מים, נשימה אחת. הילד מסביר את הסוגיה בקול, ההורה שואל שאלה אחת בלבד. אם נתקע, פשוט קוראים יחד מהתחלה בלי הערות.",
      },
    ],
    faq: [
      {
        q: "כמה זמן ביום מומלץ?",
        a: "לילד בכיתות א-ג — עד 25 דקות. לילד בכיתות ד-ו — עד 40 דקות. יותר מזה שוחק.",
      },
    ],
  },
};

export const Route = createFileRoute("/parents-guide/$slug")({
  loader: ({ params }) => {
    const guide = GUIDES[params.slug];
    if (!guide) throw notFound();
    return { guide, slug: params.slug };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "לא נמצא" }, { name: "robots", content: "noindex" }] };
    }
    const { guide, slug } = loaderData;
    const url = `${BASE}/parents-guide/${slug}`;
    return {
      meta: [
        { title: `${guide.title} · מדריך הורים` },
        { name: "description", content: guide.description },
        { property: "og:title", content: guide.title },
        { property: "og:description", content: guide.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.description,
            inLanguage: "he",
            datePublished: guide.updated,
            dateModified: guide.updated,
            author: { "@type": "Organization", name: "ClassAlign" },
            mainEntityOfPage: url,
          }),
        },
        guide.faq.length > 0 && {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guide.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ].filter(Boolean) as { type: string; children: string }[],
    };
  },
  notFoundComponent: () => (
    <div dir="rtl" className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">הדף לא נמצא</h1>
      <Link to="/parents-guide" className="mt-4 inline-block text-primary">
        חזרה למרכז ההורים
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div dir="rtl" className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">שגיאה בטעינה</h1>
    </div>
  ),
  component: GuidePage,
});

function GuidePage() {
  const { guide } = Route.useLoaderData() as { guide: Guide };
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/parents-guide" className="text-sm text-muted-foreground hover:text-foreground">
            → מרכז ההורים
          </Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <article>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{guide.title}</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">{guide.description}</p>

          <div className="mt-10 space-y-8">
            {guide.sections.map((s) => (
              <section key={s.h}>
                <h2 className="text-xl font-semibold">{s.h}</h2>
                {Array.isArray(s.p) ? (
                  <ul className="mt-3 list-disc space-y-2 pr-5 text-muted-foreground">
                    {s.p.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 leading-relaxed text-muted-foreground">{s.p}</p>
                )}
              </section>
            ))}
          </div>

          {guide.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">שאלות נפוצות</h2>
              <dl className="mt-4 space-y-4">
                {guide.faq.map((f) => (
                  <div key={f.q} className="rounded-xl border border-border/60 bg-card/40 p-5">
                    <dt className="font-semibold">{f.q}</dt>
                    <dd className="mt-2 text-muted-foreground">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <footer className="mt-12 rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
            רב יקר — הדף הזה בנוי לשיתוף עם ההורים. אפשר להעתיק את הקישור ולשלוח בקבוצה,
            או להטמיע בדף הכיתה הציבורי שלכם.
          </footer>
        </article>
      </main>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";

const BASE = "https://cuddle-spark-nexus.lovable.app";
const URL = `${BASE}/partners/case-studies`;
const TITLE = "Case Studies — סיפורי הטמעה של ClassAlign בבתי ספר ותלמודי תורה";
const DESCRIPTION =
  "דוגמאות אמיתיות של הטמעת ClassAlign במחוזות, ישיבות קטנות ותלמודי תורה: יעדים, שלבי עבודה, לוחות זמנים ותוצאות מדידות בטווח 90 יום.";

type CaseStudy = {
  slug: string;
  org: string;
  segment: string;
  size: string;
  summary: string;
  challenge: string[];
  approach: { title: string; body: string }[];
  results: { metric: string; before: string; after: string }[];
  quote: { text: string; author: string };
  timeline: { week: string; milestone: string }[];
};

const STUDIES: CaseStudy[] = [
  {
    slug: "yeshiva-ktana-jerusalem",
    org: "ישיבה קטנה — ירושלים",
    segment: "ישיבה קטנה חסידית",
    size: "6 שיעורים · 148 בחורים · 9 ר״מים",
    summary:
      "החלפת מחברות ידניות במעקב דיגיטלי אחיד — קיצור זמן הכנת דו״ח שבועי מ-90 ל-12 דקות בממוצע.",
    challenge: [
      "כל ר״מ ניהל מחברת נפרדת — אין תמונת מצב אחידה למשגיח.",
      "דו״חות להורים נכתבו ידנית ולקחו ערב שלם בכל שבוע.",
      "התקדמות בסוגיא לא תועדה — קשה לזהות בחור שנשאר מאחור.",
    ],
    approach: [
      { title: "הדרכה בשני מפגשים", body: "מפגש ראשון לר״מים, מפגש שני למשגיח על דוחות אגרגטיביים ותצוגה כיתתית." },
      { title: "ייבוא רשימות מ-Excel", body: "רשימת הבחורים הועלתה מקובץ קיים תוך פחות מ-5 דקות לכל שיעור." },
      { title: "תבניות עלון מותאמות", body: "עלון שבועי בעברית עם כותרת הישיבה וגופן Heebo, מוכן להדפסה ולוואטסאפ." },
    ],
    results: [
      { metric: "זמן הכנת דוח שבועי", before: "90 דק׳", after: "12 דק׳" },
      { metric: "אחוז דוחות שנשלחו בזמן", before: "62%", after: "97%" },
      { metric: "זיהוי בחורים שנשארו מאחור", before: "אחרי חודש+", after: "בתוך שבוע" },
    ],
    quote: {
      text: "המערכת הפכה את הישיבה למסונכרנת. המשגיח רואה תמונת מצב אמיתית, וכל ר״מ עובד באותה שפה.",
      author: "מנהל פדגוגי, ישיבה קטנה",
    },
    timeline: [
      { week: "שבוע 1", milestone: "הקמת חשבונות ותצורה בסיסית" },
      { week: "שבוע 2-3", milestone: "הדרכת ר״מים, ייבוא נתונים" },
      { week: "שבוע 4-8", milestone: "שימוש יומי, ליווי שוטף" },
      { week: "שבוע 9-12", milestone: "מדידת תוצאות והתאמת תבניות" },
    ],
  },
  {
    slug: "talmud-torah-bnei-brak",
    org: "רשת ת״ת — בני ברק",
    segment: "רשת תלמודי תורה",
    size: "3 סניפים · 24 כיתות · 620 תלמידים",
    summary:
      "אחידות פדגוגית בין 3 סניפים באמצעות דשבורד מחוזי — עלייה של 18% בעמידה ביעדי דפים שבועיים.",
    challenge: [
      "כל סניף עבד בשיטה שונה — קשה לזהות שיטות עבודה מוצלחות.",
      "מנהל הרשת קיבל דוחות באיחור של שבועיים ובפורמטים שונים.",
      "מלמדים חדשים בילו זמן רב בהבנת שיטת המעקב.",
    ],
    approach: [
      { title: "דשבורד מחוזי", body: "תצוגה משווה בין הסניפים על יעדי דפים, נוכחות והתקדמות בקריאה." },
      { title: "מדריך הטמעה אחיד", body: "כל מלמד חדש עובר הדרכה של שעתיים ומתחיל לתעד ביום הראשון." },
      { title: "עלוני קבלת שבת", body: "תבנית קבועה לרשת עם לוגו — כל סניף רק מלא את התוכן." },
    ],
    results: [
      { metric: "עמידה ביעדי דפים שבועיים", before: "71%", after: "89%" },
      { metric: "זמן קליטת מלמד חדש", before: "3 שבועות", after: "3 ימים" },
      { metric: "דיוק דוחות למנהל הרשת", before: "±14 יום", after: "real-time" },
    ],
    quote: {
      text: "בפעם הראשונה יש לי תמונת מצב אמיתית של כל שלושת הסניפים במסך אחד.",
      author: "מנהל רשת תלמודי תורה",
    },
    timeline: [
      { week: "שבוע 1-2", milestone: "פיילוט בסניף אחד" },
      { week: "שבוע 3-6", milestone: "הרחבה לשני הסניפים הנוספים" },
      { week: "שבוע 7-10", milestone: "כיול תבניות ותהליכי עבודה" },
      { week: "שבוע 11-12", milestone: "מדידת תוצאות והצגה להנהלה" },
    ],
  },
  {
    slug: "beit-sefer-mamlachti-dati",
    org: "בית ספר ממ״ד — מרכז",
    segment: "בית ספר יסודי דתי",
    size: "12 כיתות · 340 תלמידים · 22 מחנכות",
    summary:
      "מעבר מ-3 מערכות שונות למערכת אחת — חיסכון של 6 שעות שבועיות בממוצע לכל מחנכת.",
    challenge: [
      "ציונים במערכת אחת, נוכחות בשנייה, תקשורת עם הורים בשלישית.",
      "מחנכות בילו זמן רב בהעברת נתונים בין המערכות.",
      "הורים קיבלו הודעות בערוצים שונים ואיבדו מידע.",
    ],
    approach: [
      { title: "איחוד לפלטפורמה אחת", body: "ציונים, נוכחות, התנהגות ותקשורת — הכל במקום אחד." },
      { title: "דף כיתה ציבורי אנונימי", body: "ההורים רואים ממוצעים כיתתיים ועלונים ללא חשיפת פרטי תלמידים." },
      { title: "אינטגרציה עם קליטת ציונים בקול/תמונה", body: "מחנכת יכולה לצלם דף מבחן ולקבל טבלת ציונים מוכנה לאישור." },
    ],
    results: [
      { metric: "זמן ניהול שבועי למחנכת", before: "9 שע׳", after: "3 שע׳" },
      { metric: "מעורבות הורים בדוחות", before: "44%", after: "78%" },
      { metric: "מספר מערכות בשימוש", before: "3", after: "1" },
    ],
    quote: {
      text: "פעם הייתי משקיעה ערב שלם בדוחות. היום אני מסיימת בדרך הביתה מהעבודה.",
      author: "מחנכת כיתה ד׳",
    },
    timeline: [
      { week: "שבוע 1", milestone: "מיפוי נתונים מ-3 המערכות" },
      { week: "שבוע 2-4", milestone: "ייבוא ותצורה" },
      { week: "שבוע 5-8", milestone: "הדרכות ופיילוט מקביל" },
      { week: "שבוע 9-12", milestone: "מעבר מלא וסגירת המערכות הישנות" },
    ],
  },
];

export const Route = createFileRoute("/partners/case-studies")({
  component: CaseStudiesPage,
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
          itemListElement: STUDIES.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${URL}#${s.slug}`,
            name: `${s.org} — ${s.summary}`,
          })),
        }),
      },
    ],
  }),
});

function CaseStudiesPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/partners" className="text-sm text-muted-foreground hover:text-foreground">→ שיתופי פעולה</Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Case Studies — תוצאות אמיתיות מהשטח</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground leading-relaxed">
          סיפורי הטמעה של רבנים, ר״מים ומחנכות שעבדו איתנו. כל מקרה כולל אתגרים,
          שלבי עבודה, לוח זמנים של 90 יום ומדדים מדידים לפני ואחרי. אפשר לקשר ישירות לכל סיפור לפי עוגן.
        </p>

        <nav aria-label="רשימת המקרים" className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">בדף הזה</h2>
          <ol className="mt-2 grid list-decimal gap-1 pr-5 text-sm sm:grid-cols-3">
            {STUDIES.map((s) => (
              <li key={s.slug}>
                <a href={`#${s.slug}`} className="text-primary hover:underline">{s.org}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-16">
          {STUDIES.map((s) => (
            <article key={s.slug} id={s.slug} className="scroll-mt-24 rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{s.segment}</span>
                <span className="text-xs text-muted-foreground">{s.size}</span>
              </div>
              <h2 className="mt-3 text-xl font-bold sm:text-2xl">
                <a href={`#${s.slug}`} className="me-2 text-muted-foreground opacity-60 hover:opacity-100" aria-label="קישור ישיר">#</a>
                {s.org}
              </h2>
              <p className="mt-2 text-base text-muted-foreground leading-relaxed">{s.summary}</p>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground">האתגר</h3>
                  <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
                    {s.challenge.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground">הגישה</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {s.approach.map((a, i) => (
                      <li key={i}>
                        <span className="font-semibold">{a.title}:</span>{" "}
                        <span className="text-muted-foreground">{a.body}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground">תוצאות אחרי 90 יום</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-start text-xs uppercase text-muted-foreground">
                        <th className="py-2 pe-4 text-start">מדד</th>
                        <th className="py-2 pe-4 text-start">לפני</th>
                        <th className="py-2 text-start">אחרי</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {s.results.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 pe-4 font-medium">{r.metric}</td>
                          <td className="py-2 pe-4 text-muted-foreground">{r.before}</td>
                          <td className="py-2 font-semibold text-primary">{r.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground">לוח זמנים (12 שבועות)</h3>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {s.timeline.map((t, i) => (
                    <li key={i} className="rounded-lg border border-border/40 bg-background/40 p-3">
                      <div className="text-xs font-semibold text-primary">{t.week}</div>
                      <div className="mt-1 text-sm">{t.milestone}</div>
                    </li>
                  ))}
                </ol>
              </section>

              <blockquote className="mt-6 border-s-2 border-primary/60 ps-4 text-sm italic text-muted-foreground">
                "{s.quote.text}"
                <footer className="mt-1 text-xs not-italic">— {s.quote.author}</footer>
              </blockquote>
            </article>
          ))}
        </div>

        <section className="mt-16 rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
          <h2 className="text-xl font-semibold">רוצה להטמיע במחוז או בבית הספר שלך?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            צוות ההטמעה שלנו בונה תוכנית של 90 יום מותאמת לגודל ולסוג המוסד.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/partners/districts" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              למחוזות ורשתות ←
            </Link>
            <Link to="/partners/schools" className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold hover:bg-card/60">
              לבתי ספר וישיבות ←
            </Link>
            <a href="mailto:partners@classalign.studio" className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold hover:bg-card/60">
              דבר איתנו ←
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
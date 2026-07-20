import { createFileRoute, Link, notFound } from "@tanstack/react-router";

const BASE = "https://cuddle-spark-nexus.lovable.app";

type Section = { id: string; heading: string; body: string[] };
type Article = {
  title: string;
  description: string;
  sections: Section[];
  faq?: { q: string; a: string }[];
};

const ARTICLES: Record<string, Article> = {
  "setup-grade-tracking": {
    title: "איך להגדיר מעקב ציונים בכיתה שלך",
    description:
      "מדריך מלא להתחלת מעקב ציונים ב-ClassAlign: יצירת כיתה, הוספת תלמידים, קליטת ציונים וצפייה בדוחות.",
    sections: [
      {
        id: "create-class",
        heading: "1. יצירת כיתה חדשה",
        body: [
          "היכנס למסך 'הכיתות שלי' ולחץ על 'כיתה חדשה'.",
          "בחר שם ברור (למשל: שיעור ב׳ — גמרא) והמקצוע הראשי. אפשר להוסיף מקצועות נוספים בהמשך.",
        ],
      },
      {
        id: "add-students",
        heading: "2. הוספת תלמידים",
        body: [
          "אפשר להקליד ידנית, להעלות קובץ Excel/CSV, או לצלם דף רשימה — הבינה המלאכותית תזהה את השמות אוטומטית.",
          "כל תלמיד מקבל פרופיל: הערות, מידות, יעדים אישיים, ופרטי הורים.",
        ],
      },
      {
        id: "enter-grades",
        heading: "3. קליטת ציונים",
        body: [
          "בכיתה, לחץ 'ציון חדש'. אפשר להקליד, להכתיב בקול, או להעלות צילום של דף ציונים.",
          "לכל ציון אפשר לצרף הערה, משקל, ותאריך. הממוצע מתעדכן מיד.",
        ],
      },
      {
        id: "view-reports",
        heading: "4. צפייה בדוחות",
        body: [
          "לוח הבקרה מציג התקדמות שבועית, פערים בין תלמידים, ותלמידים שדורשים חיזוק.",
          "ניתן לייצא PDF שבועי או חודשי, ולשתף באופן אנונימי דרך דף הכיתה הציבורי.",
        ],
      },
    ],
    faq: [
      {
        q: "מה עדיף — סולם 1-5 או 0-100?",
        a: "בחיידר סולם 1-5 עובד יותר טוב כי הוא ברור להורים ומקטין ויכוחים סביב פערים קטנים. בבית ספר תיכון סולם 0-100 מקובל יותר.",
      },
      {
        q: "האם אפשר לשנות משקל של מבחן בדיעבד?",
        a: "כן. פתח את הציון, שנה את המשקל, והממוצע יחושב מחדש אוטומטית.",
      },
    ],
  },
  "grading-scale-and-weights": {
    title: "סולם ציונים ומשקלות בין מקצועות",
    description: "איך לבחור סולם, לקבוע משקלים ולהבין את הממוצע המשוקלל של תלמיד.",
    sections: [
      { id: "choose-scale", heading: "בחירת סולם", body: ["בהגדרות הכיתה בחר בין 1-5 (מומלץ לחיידר) לבין 0-100."] },
      { id: "weights", heading: "משקלים", body: ["ניתן לקבוע לכל סוג משימה משקל שונה: מבחן 50%, הכנה 30%, השתתפות 20%."] },
      { id: "weighted-avg", heading: "ממוצע משוקלל", body: ["הממוצע מתחשב בכל המשקלים — פתח את פרופיל התלמיד לראות את הפירוט המלא."] },
    ],
  },
  "import-grades-from-image": {
    title: "קליטת ציונים מתמונה או קול",
    description: "העלה צילום של דף ציונים או הקלט את עצמך מקריא — המערכת מזהה שמות וציונים.",
    sections: [
      { id: "photo", heading: "צילום דף ציונים", body: ["פתח 'קליטה חכמה' → העלה תמונה. AI יוציא רשימת 'שם: ציון' לבדיקה."] },
      { id: "voice", heading: "הכתבה קולית", body: ["לחץ על הכפתור הכתום, הקלט 'יוסי 85, שמואל 92', והמערכת תמלא את הטופס."] },
      { id: "review", heading: "בדיקה ואישור", body: ["תמיד יש שלב בדיקה עם דירוג ביטחון (confidence) לפני שמירה סופית."] },
    ],
  },
  "weekly-reports": {
    title: "דוחות שבועיים ושליחה להורים",
    description: "איך לבנות דוח שבועי מסודר ולשתף אותו עם ההורים בערוץ המתאים.",
    sections: [
      { id: "generate", heading: "יצירת דוח", body: ["במסך 'עלונים' לחץ 'דוח שבועי'. הבינה בונה טיוטה על סמך הנתונים."] },
      { id: "export", heading: "ייצוא PDF", body: ["PDF תומך RTL מלא עם גופן Heebo — מוכן להדפסה או שליחה בוואטסאפ."] },
      { id: "public-share", heading: "דף כיתה ציבורי", body: ["ניתן לשתף לינק אנונימי המציג ממוצעים ועלונים ללא שמות תלמידים."] },
    ],
  },
  "mobile-usage": {
    title: "שימוש במובייל וב-Android",
    description: "כל המסכים מותאמים לטלפון, ויש אפליקציית Android להתקנה.",
    sections: [
      { id: "responsive", heading: "עיצוב רספונסיבי", body: ["כפתורים גדולים למגע, ניווט תחתון, וגלילה חלקה גם עם ידית אחת."] },
      { id: "android", heading: "אפליקציית Android", body: ["ניתן להתקין APK מקומי. ראה מסמך RELEASE_ANDROID.md בפרויקט להוראות בנייה."] },
      { id: "offline", heading: "שימוש offline", body: ["חלק מהמסכים נטענים מראש (sound-board, seating) — פעולות כתיבה דורשות חיבור."] },
    ],
  },
  "privacy-and-pin": {
    title: "אבטחה, PIN ופרטיות תלמידים",
    description: "איך המערכת שומרת על פרטיות התלמידים ואיך לנעול את האפליקציה.",
    sections: [
      { id: "pin", heading: "הגדרת PIN", body: ["הגדרות → אבטחה → קבע PIN בן 4-6 ספרות. הוא נשמר מוצפן ולא ניתן לשחזר."] },
      { id: "sharing", heading: "מדיניות שיתוף", body: ["דף כיתה ציבורי חושף רק נתונים מצטברים. לא נחשפים שמות תלמידים או ציונים אישיים."] },
      { id: "data", heading: "נתוני המשתמש", body: ["הנתונים שייכים למלמד ואינם משותפים עם מלמדים אחרים או צד שלישי."] },
    ],
  },
};

export const Route = createFileRoute("/help/$slug")({
  loader: ({ params }) => {
    const article = ARTICLES[params.slug];
    if (!article) throw notFound();
    return { article, slug: params.slug };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <div dir="rtl" className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">המאמר לא נמצא</h1>
      <Link to="/help" className="mt-4 inline-block text-primary hover:underline">חזרה למרכז העזרה</Link>
    </div>
  ),
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "מאמר לא נמצא — מרכז עזרה" }, { name: "robots", content: "noindex" }] };
    }
    const url = `${BASE}/help/${params.slug}`;
    const { article } = loaderData;
    return {
      meta: [
        { title: `${article.title} — מרכז עזרה ClassAlign` },
        { name: "description", content: article.description },
        { property: "og:title", content: article.title },
        { property: "og:description", content: article.description },
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
            "@type": "TechArticle",
            headline: article.title,
            description: article.description,
            inLanguage: "he",
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "ClassAlign Studio" },
          }),
        },
        ...(article.faq
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  inLanguage: "he",
                  mainEntity: article.faq.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                }),
              },
            ]
          : []),
      ],
    };
  },
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/help" className="text-sm text-muted-foreground hover:text-foreground">→ מרכז עזרה</Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <article>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">{article.description}</p>

          <nav aria-label="תוכן עניינים" className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-4">
            <h2 className="text-sm font-semibold text-muted-foreground">תוכן עניינים</h2>
            <ol className="mt-2 list-decimal space-y-1 pr-5 text-sm">
              {article.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-primary hover:underline">{s.heading}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {article.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="group text-xl font-semibold sm:text-2xl">
                  <a href={`#${s.id}`} className="me-2 text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-label="קישור ישיר">#</a>
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-muted-foreground">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {article.faq && article.faq.length > 0 ? (
            <section id="faq" className="mt-12 scroll-mt-24">
              <h2 className="text-xl font-semibold sm:text-2xl">שאלות ותשובות</h2>
              <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
                {article.faq.map((f, i) => (
                  <details key={i} className="group p-5 open:bg-card/60">
                    <summary className="cursor-pointer text-base font-medium">{f.q}</summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה להעמיק?</p>
            <Link to="/help" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              חזרה למרכז העזרה ←
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
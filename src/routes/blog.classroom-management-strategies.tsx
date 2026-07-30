import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/classroom-management-strategies";
const TITLE = "אסטרטגיות ניהול כיתה — מדריך למלמד המקצועי בתלמוד תורה";
const DESCRIPTION =
  "מדריך מקצועי לניהול כיתה במגזר החרדי: תגבור התנהגות חיובית, עיצוב סביבת למידה, מעקב פדגוגי מבוסס נתונים ושגרות שמייצרות שקט אמיתי בכיתה.";

const STRATEGIES: { title: string; body: string; bullets: string[] }[] = [
  {
    title: "1. תגבור התנהגות חיובית (Positive Behavior Support)",
    body:
      "במקום להגיב רק על התנהגות שלילית, בונים מערכת שמזהה ומחזקת רגעים חיוביים. במחקר החינוכי המודרני זו נחשבת האסטרטגיה היעילה ביותר להורדת אירועי משמעת ולהעלאת מעורבות התלמידים.",
    bullets: [
      "הגדר 3–5 ציפיות ברורות מנוסחות בחיוב (\"מדברים בשקט\" ולא \"לא צועקים\").",
      "החזק על כל תלמיד לפחות יחס של 4:1 — ארבע חיזוקים חיוביים על כל תיקון.",
      "השתמש בנקודות זכות / כוכבים עם פרסים קטנים שהתלמיד בוחר בעצמו.",
      "צור טקס יומי של \"פותחים ביום טוב\" — 60 שניות של שבח קבוצתי.",
    ],
  },
  {
    title: "2. עיצוב סביבת הלמידה (Environment Optimization)",
    body:
      "מבנה הכיתה משפיע על ההתנהגות לא פחות מהמלמד. סידור נכון של מושבים, אזורי שקט וגבולות ויזואליים מפחית עומס קוגניטיבי ומצמצם עימותים.",
    bullets: [
      "מפת ישיבה מבוססת נתונים — מי מרוויח מלשבת קדימה, מי מפריע כשיושבים ליד חלון.",
      "אזור שקט מוגדר לקריאה עצמית ולהתאוששות רגשית — לא כענישה.",
      "לוח יומי גלוי עם סדר היום, כדי לצמצם שאלות \"מה עכשיו?\".",
      "החלפת מפת ישיבה כל 4–6 שבועות, מבוססת על ציונים ודינמיקה חברתית.",
    ],
  },
  {
    title: "3. שגרות ופרוצדורות (Consistent Routines)",
    body:
      "מלמד מקצועי לא מנהל את הכיתה בכל רגע — הוא מלמד את הכיתה לנהל את עצמה. שגרות ברורות ליציאה לתפילה, לחלוקת חוברות ולזמן חזרה מדחיסות עשרות דקות בכל שבוע.",
    bullets: [
      "5 שגרות ליבה: כניסה, יציאה, מעבר בין מקצועות, שאלה של תלמיד, סוף היום.",
      "מלמדים כל שגרה כאילו זה שיעור — הדגמה, תרגול, משוב.",
      "משתמשים בסימני שקט חזותיים (יד מורמת, פעמון עדין) במקום לצעוק.",
      "מודיעים מראש על מעברים — \"עוד שתי דקות עוברים לגמרא\".",
    ],
  },
  {
    title: "4. הוראה מבוססת נתונים (Data-Driven Instruction)",
    body:
      "החלטות פדגוגיות טובות מתחילות בנתונים. מעקב שיטתי אחר ציונים, נוכחות ונקודות התנהגות חושף מגמות שלא רואים בעין — ומאפשר התערבות ממוקדת מוקדם.",
    bullets: [
      "בדוק אחת לשבוע מי צנח ביותר מ-10 נקודות ממוצע — סימן מוקדם לקושי.",
      "עקוב אחר שכיחות איחורים ונקודות שליליות לפי יום בשבוע — יש דפוסים.",
      "לפני שיחת הורים, הכן דו״ח מודפס עם עובדות — לא רק תחושות.",
      "השתמש בהפקת תעודות תקופתית כמפגש אמת מול ההתקדמות.",
    ],
  },
  {
    title: "5. חיבור בית–חיידר (Family Partnership)",
    body:
      "ניהול כיתה אפקטיבי לא נעצר בסוף היום. תקשורת שוטפת ומכובדת עם ההורים מוריאה מתחים, מייצרת גיבוי משמעתי בבית ומחזקת את הסמכות של המלמד.",
    bullets: [
      "דו״ח שבועי קצר (3–5 שורות) לכל הורה — גם כשאין בעיות.",
      "התקשר לפני שאתה מסמס — קול חם עוצר הרבה אי־הבנות.",
      "השאר \"ערוץ טוב\" — לפחות פנייה חיובית אחת לחודש על כל תלמיד.",
      "שתף את ההורים בציפיות ובשגרות — לא רק בעונשים.",
    ],
  },
];

export const Route = createFileRoute("/blog/classroom-management-strategies")({
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
          keywords: [
            "אסטרטגיות ניהול כיתה",
            "ניהול כיתה",
            "תגבור התנהגות חיובית",
            "מעקב פדגוגי",
            "תלמוד תורה",
          ],
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
            אסטרטגיות ניהול כיתה טובות מפחיתות שחיקה למלמד, מעלות את רמת ההוראה ומשפרות את
            אווירת החיידר. המדריך הזה מסכם חמש אסטרטגיות מקצועיות שמתאימות במיוחד לרבנים
            ומלמדים בתלמודי תורה, יחד עם דרכים פרקטיות ליישם כל אחת מהן — עם או בלי הכלים
            הדיגיטליים של הכיתה שלי.
          </p>

          <div className="mt-8 space-y-6">
            {STRATEGIES.map((s) => (
              <section key={s.title} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <h2 className="!mt-0 text-xl font-semibold">{s.title}</h2>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
                <ul className="mt-3 list-disc pr-4 text-sm text-muted-foreground">
                  {s.bullets.map((b) => <li key={b} className="mt-1">{b}</li>)}
                </ul>
              </section>
            ))}
          </div>

          <h2>איך ClassAlign מסייע ליישם את האסטרטגיות?</h2>
          <p>
            הכלים של{" "}
            <Link to="/" className="text-primary hover:underline">הכיתה שלי</Link>{" "}
            תוכננו סביב חמש האסטרטגיות שלמעלה: מערכת נקודות התנהגות עם הגרלות ופרסים,
            מחולל קבוצות ומפת ישיבה חכמה, שגרות סאונד־בורד לניהול מעברים, דו״חות שבועיים
            אוטומטיים להורים, וסיכומי תעודה תקופתיים מבוססי נתונים אמיתיים.
          </p>

          <h2>מה לעשות מחר בבוקר?</h2>
          <p>
            בחר אסטרטגיה אחת בלבד להתחיל איתה השבוע. שינוי אחד ברור עדיף על חמישה חצי־שינויים.
            אחרי שבועיים, הוסף את הבאה — כך בונים ניהול כיתה בר־קיימא לאורך שנה שלמה.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה כלים שיטתיים שמיישמים את זה בכיתה שלך?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה ב-ClassAlign ←
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <p className="text-sm text-muted-foreground">רוצה גרסת PDF להדפסה עם שם המוסד שלך?</p>
            <Link
              to="/blog/classroom-management-strategies/checklist"
              className="mt-2 inline-block text-base font-semibold text-primary hover:underline"
            >
              הורד צ'קליסט מודפס (PDF) ←
            </Link>
          </div>

          <h2 className="!mt-12">מדריכים משלימים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">מעקב התקדמות תלמידים — מדריך מלא</Link></li>
            <li><Link to="/blog/classroom-tools-teachers" className="text-primary hover:underline">10 כלי הוראה חינמיים שכל מלמד חייב</Link></li>
            <li><Link to="/blog/weekly-report-template" className="text-primary hover:underline">תבנית דו״ח שבועי לתלמיד</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/digital-hall-pass-guide";
const TITLE = "ניהול אישורי יציאה דיגיטליים בתלמוד תורה — מדריך מלא";
const DESCRIPTION =
  "מדריך לרבנים ומנהלי תלמודי תורה: איך מערכת אישורי יציאה דיגיטלית מצמצמת הפרעות, שומרת על סדר וביטחון, ומחליפה את eHallPass.";

const FAQ = [
  {
    q: "מהי החלופה הטובה ביותר ל-eHallPass עבור תלמוד תורה?",
    a: "מערכת בעברית עם ממשק RTL שמתאימה למבנה החיידר (כמה מלמדים, סדר יום של לימודי קודש) — כמו ClassAlign Studio — תיתן יותר ערך מ-eHallPass שתוכנן לבתי ספר אמריקאיים.",
  },
  {
    q: "האם אפשר לנהל אישורי יציאה בלי אינטרנט?",
    a: "כן. ClassAlign עובדת במצב מקומי, רושמת את היציאות והחזרות במכשיר, ומסתנכרנת ברגע שהחיבור חוזר.",
  },
  {
    q: "כמה זמן לוקח להטמיע מערכת אישורי יציאה דיגיטלית?",
    a: "פחות מעשר דקות לרב, ויום אחד להרגיל את התלמידים. הכלל פשוט: יציאה רק אחרי אישור, וחזרה מסומנת באותה לחיצה.",
  },
  {
    q: "האם זה לא יוצר תחושה של 'אח גדול' בכיתה?",
    a: "לא. זה בדיוק כמו רשימת נוכחות — רק עדכני בזמן אמת. התלמידים מקבלים זאת כחלק טבעי מסדר היום.",
  },
  {
    q: "האם הדו\"חות מתאימים לשיתוף עם הורים?",
    a: "כן. דו\"ח חודשי תמציתי, בעברית, שמשתלב עם דו\"ח הציונים והנוכחות הקיים — בלי להציף את ההורים בפרטים.",
  },
];

export const Route = createFileRoute("/blog/digital-hall-pass-guide")({
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
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
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
          author: { "@type": "Organization", name: "ClassAlign Studio" },
          publisher: {
            "@type": "Organization",
            name: "ClassAlign Studio",
            url: "https://cuddle-spark-nexus.lovable.app/",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "בית", item: "https://cuddle-spark-nexus.lovable.app/" },
            { "@type": "ListItem", position: 2, name: "בלוג", item: "https://cuddle-spark-nexus.lovable.app/blog" },
            { "@type": "ListItem", position: 3, name: TITLE, item: URL },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: "he",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
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
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה לבלוג
          </Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-invert max-w-none [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mt-4 [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pr-6 [&_li]:mt-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{TITLE}</h1>
          <p className="mt-4 text-muted-foreground">
            מדריך לרבנים, מלמדים ומנהלי תלמודי תורה וחיידרים — איך לנהל יציאות מהכיתה
            בצורה מסודרת, מכובדת ובטוחה, בעזרת כלים דיגיטליים פשוטים.
          </p>

          <h2>מה הבעיה עם "הפתק" הישן?</h2>
          <p>
            בכל תלמוד תורה מכירים את התמונה: תלמיד ניגש אל הרב באמצע הסוגיא, מבקש פתק
            ליציאה לשירותים, הרב חותם בחיפזון, והפתק עובר מיד ליד עד שהוא נעלם. השיטה
            הישנה עובדת — אבל היא גובה מחיר: הפרעה לסדר השיעור, חוסר בהירות מי יצא ומתי
            חזר, ולעיתים תלמידים שמנצלים את חוסר המעקב כדי לשהות מחוץ לכיתה זמן ממושך.
          </p>

          <h2>מהי מערכת אישורי יציאה דיגיטלית?</h2>
          <p>
            במקום פתק נייר, התלמיד מקבל אישור דיגיטלי קצר: הרב מאשר בלחיצה, המערכת רושמת
            את שעת היציאה ושעת החזרה, וכל היציאות נשמרות באופן מסודר. ברוב המערכות
            (כמו eHallPass המקובלת בבתי הספר באמריקה) קיימת גם הגבלת זמן וחיווי ויזואלי
            למלמד.
          </p>
          <p>
            הרעיון אינו "השגחה מוגזמת", אלא <strong>שקיפות ואחריות</strong> — בדיוק כפי
            שהרבנים הגדולים תמיד עמדו על חשיבותו של סדר היום בתלמוד תורה.
          </p>

          <h2>היתרונות בעולם החרדי</h2>
          <ul>
            <li>
              <strong>שמירה על סדר השיעור:</strong> אין הפסקה של זרם הלימוד בכל פעם שאחד
              התלמידים מתקרב לבימה.
            </li>
            <li>
              <strong>ביטחון:</strong> הרב יודע בכל רגע נתון מי לא נמצא בכיתה — קריטי
              במיוחד במוסדות שבהם תלמידים צעירים.
            </li>
            <li>
              <strong>אחריות אישית:</strong> התלמיד לומד שהיציאה מהכיתה היא פעולה מתועדת
              ולא "חופשי לזרום".
            </li>
            <li>
              <strong>דו"חות להורים ולמנהל:</strong> כאשר יש דפוס חוזר של יציאות, אפשר
              לזהות זאת מבעוד מועד ולשוחח עם ההורים.
            </li>
            <li>
              <strong>פחות נייר, פחות בלגן:</strong> אין יותר ערימות פתקים על השולחן של
              הרב.
            </li>
          </ul>

          <h2>חלופות נפוצות ומה ההבדל</h2>
          <h3>eHallPass ומערכות אמריקאיות</h3>
          <p>
            פתרונות כמו eHallPass, SmartPass או Securly Pass נפוצים מאוד במערכת החינוך
            האמריקאית. הם מצוינים מבחינה טכנית, אך נבנו עבור בתי ספר ציבוריים: הממשק
            באנגלית, המודל מבוסס על מורה אחד לכיתה, והם אינם מותאמים למבנה של חיידר —
            כמה מלמדים במשמרות, סדר יום של לימודי קודש, ושפת ממשק בעברית.
          </p>
          <h3>פתק ידני + לוח על הקיר</h3>
          <p>
            פתרון נפוץ בהרבה חיידרים — זול ופשוט, אך אינו שורד אחרי שבוע. הפתקים
            הולכים לאיבוד, אין דו"חות, ואין דרך לראות דפוסים לאורך זמן.
          </p>
          <h3>ClassAlign Studio</h3>
          <p>
            המערכת שלנו נבנתה מההתחלה עבור תלמודי תורה, חיידרים ובתי ספר חרדיים:
            ממשק עברית RTL מלא, מינוחים של "הרב" ו"המלמד", מקצועות קודש (גמרא, משנה,
            חומש, נביא, הלכה), ומעקב יומיומי שמשתלב באופן טבעי עם רשימת הנוכחות והציונים
            הקיימים. אישור היציאה הוא חלק מתוך מערכת מעקב שלמה — ולא אפליקציה נפרדת.
          </p>
          <p className="text-sm text-muted-foreground">
            רוצה להעמיק? עיין ב<Link to="/" className="text-primary hover:underline">דף הבית של ClassAlign</Link>
            {" "}או חזור ל<Link to="/blog" className="text-primary hover:underline">מאמרים נוספים בבלוג</Link>.
          </p>

          <h2>איך מתחילים? צ'קליסט להטמעה בחיידר</h2>
          <ul>
            <li>בחירת מכשיר אחד לכיתה (טאבלט פשוט או מחשב של הרב).</li>
            <li>הגדרת רשימת התלמידים פעם אחת בתחילת השנה.</li>
            <li>קביעת כלל פשוט: יציאה רק אחרי אישור דיגיטלי, וחזרה מסומנת באותה דרך.</li>
            <li>סקירה שבועית של הדו"ח — לזהות תלמיד שיוצא הרבה ולברר מה ברקע.</li>
            <li>שיתוף ההורים פעם בחודש, בעדינות, כחלק מהדו"ח החודשי הכללי.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            כדי להתחיל לעבוד עם המערכת, אפשר{" "}
            <Link to="/login" className="text-primary hover:underline">להיכנס לחשבון הרב</Link>{" "}
            ולבנות כיתה ראשונה תוך דקות.
          </p>

          <h2>שאלות נפוצות על חלופות ל-eHallPass וניהול אישורי יציאה</h2>
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}

          <h2>סיכום</h2>
          <p>
            ניהול אישורי יציאה דיגיטלי הוא לא "גאדג'ט" — זה כלי שמחזיר לרב את השליטה
            על קצב השיעור, שומר על ביטחון התלמידים, ובונה אצלם הרגלי אחריות. בעולם
            המודרני, גם בתלמוד תורה, יש מקום לכלים שמכבדים את המסורת ומשרתים אותה —
            במקום להפריע לה.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">
              רוצה לראות איך זה נראה בפועל?
            </p>
            <Link
              to="/"
              className="mt-2 inline-block text-base font-semibold text-primary hover:underline"
            >
              גלה את ClassAlign Studio ←
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
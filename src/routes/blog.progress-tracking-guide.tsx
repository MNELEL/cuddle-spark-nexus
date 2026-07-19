import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/progress-tracking-guide";
const TITLE = "מעקב התקדמות תלמידים — מדריך מלא לרבנים ומלמדים";
const DESCRIPTION =
  "איך לבנות מערכת מעקב התקדמות תלמידים בתלמוד תורה: יעדים, אינדיקטורים, דוחות שבועיים ושיחות עם הורים — עם דוגמאות מעשיות.";

const FAQ = [
  {
    q: "כמה פעמים בשבוע כדאי לתעד התקדמות?",
    a: "רישום קצר בסוף כל יום לימודים (2-3 דקות) עדיף על סיכום שבועי ארוך — הזיכרון עדיין טרי והנתונים מדויקים יותר.",
  },
  {
    q: "מה עדיף — ציון מספרי או תיאור מילולי?",
    a: "בחיידר, שילוב של השניים. סולם 1-5 לזרימת הקריאה, הבנת הסוגיא והתנהגות, בתוספת הערה חופשית לאירועים חריגים.",
  },
  {
    q: "האם צריך לשתף את התלמיד בנתוני המעקב?",
    a: "כן — בגילאים המתאימים. תלמיד שרואה גרף של ההתקדמות שלו לומד לקבל אחריות אישית ומזהה לבד היכן צריך לחזק.",
  },
  {
    q: "איך להימנע מלהעמיס על עצמי בדיווחים?",
    a: "התחל עם שלושה אינדיקטורים בלבד: הכנה שבועית, השתתפות בשיעור, ומבחן חודשי. הרחב רק אחרי שההרגל התייצב.",
  },
];

export const Route = createFileRoute("/blog/progress-tracking-guide")({
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
          author: { "@type": "Organization", name: "ClassAlign Studio" },
          publisher: { "@type": "Organization", name: "ClassAlign Studio", url: "https://cuddle-spark-nexus.lovable.app/" },
        }),
      },
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
        <article className="prose prose-invert max-w-none [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:mt-4 [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pr-6 [&_li]:mt-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{TITLE}</h1>
          <p className="mt-4 text-muted-foreground">
            מדריך פרקטי לבניית מערכת מעקב התקדמות בתלמוד תורה — בלי גליונות אקסל אינסופיים,
            בלי הצפה של נתונים, ועם כלים שממש עוזרים לרב לקבל החלטות פדגוגיות.
          </p>

          <h2>למה בכלל צריך מעקב שיטתי?</h2>
          <p>
            רב מנוסה יודע בתחושה מי מהתלמידים מתקדם ומי דורך במקום. אבל תחושה לא מספיקה
            כשצריך לשוחח עם ההורים, לבנות קבוצות עבודה, או להסביר למנהל למה תלמיד מסוים
            זקוק לחיזוק. מעקב שיטתי הופך את התחושה לנתון — ובעולם החרדי, שבו המשפחה
            הרחבה מעורבת בחינוך, נתון מסודר שווה זהב.
          </p>

          <h2>ארבעת עמודי התווך של מעקב טוב</h2>
          <ul>
            <li><strong>יעדים ברורים:</strong> "לסיים מסכת ביצה עד פסח" עדיף על "להתקדם בגמרא".</li>
            <li><strong>אינדיקטורים מדידים:</strong> דפים ביום, אחוזי הבנה, נוכחות, השתתפות.</li>
            <li><strong>קצב דיווח קבוע:</strong> יומי קצר, שבועי מסכם, חודשי להורים.</li>
            <li><strong>פעולה על הנתונים:</strong> ישיבה שבועית קצרה של 10 דקות עם עצמך — מה עובד, מה לא.</li>
          </ul>

          <h2>שלושת האינדיקטורים לתחילת הדרך</h2>
          <h3>1. הכנה שבועית</h3>
          <p>מדד פשוט: האם התלמיד הגיע מוכן לשיעור? סולם 1-5 בסוף כל שבוע, בלי לחשוב יותר מדי.</p>
          <h3>2. השתתפות בשיעור</h3>
          <p>שאלות, תשובות, יוזמה. גם כאן סולם 1-5. מי שיושב בשקט לא בהכרח לא מבין — אבל דפוס לאורך זמן מסמן משהו.</p>
          <h3>3. תוצאות מבחן</h3>
          <p>מבחן חודשי קצר על החומר הנלמד. לא כדי לדרג — כדי לזהות פערים.</p>

          <h2>כלים דיגיטליים שחוסכים זמן</h2>
          <p>
            במקום להחזיק שלושה מחברות שונות, מערכת דיגיטלית כמו{" "}
            <Link to="/" className="text-primary hover:underline">ClassAlign Studio</Link>{" "}
            מרכזת את כל הנתונים במקום אחד: נוכחות, ציונים, הערות התנהגות, ותצוגה גרפית
            של ההתקדמות לכל תלמיד. גם{" "}
            <Link to="/blog/digital-hall-pass-guide" className="text-primary hover:underline">
              אישורי היציאה
            </Link>{" "}
            מסתנכרנים לאותו מקום, ומעניקים תמונה שלמה של סדר היום.
          </p>

          <h2>שיחת הורים על בסיס נתונים</h2>
          <p>
            במקום "הבן שלך צריך לעבוד יותר קשה", אפשר להראות: "בחודשיים האחרונים הציון
            הממוצע ירד מ-4.2 ל-3.1, ואני רואה שהוא מגיע פחות מוכן ביום ראשון". שיחה
            כזאת בונה אמון, מכבדת את ההורים כשותפים, ומייצרת שיתוף פעולה במקום התגוננות.
          </p>

          <h2>שאלות נפוצות על מעקב התקדמות</h2>
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה לראות איך נראה מעקב התקדמות מסודר במערכת אחת?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              גלה את ClassAlign Studio ←
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
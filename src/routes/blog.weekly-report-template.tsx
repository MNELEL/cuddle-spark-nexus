import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/weekly-report-template";
const TITLE = "תבנית דו״ח שבועי לתלמיד — להורדה ולשימוש בכיתה";
const DESCRIPTION =
  "תבנית דו״ח שבועי מוכנה לתלמודי תורה: שדות למעקב לימודי, התנהגותי ורוחני, עם דוגמאות מלאות ופורמט להדפסה או שליחה להורים.";

export const Route = createFileRoute("/blog/weekly-report-template")({
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
            תבנית מוכנה שאפשר להעתיק, לשנות ולהשתמש בה כבר השבוע — עם דגש על הפורמט
            המקובל בתלמודי תורה וחיידרים.
          </p>

          <h2>מבנה הדו״ח השבועי המומלץ</h2>
          <ul>
            <li><strong>פרטי התלמיד:</strong> שם, כיתה, שבוע (תאריך עברי + לועזי).</li>
            <li><strong>לימודי קודש:</strong> גמרא / משנה / חומש — דפים שנלמדו, רמת הבנה.</li>
            <li><strong>לימודי חול:</strong> חשבון, לשון, כתיבה — במידה ורלוונטי.</li>
            <li><strong>מידות והתנהגות:</strong> יחס לחברים, זריזות לתפילה, שמירה על סדר.</li>
            <li><strong>הערת הרב:</strong> משפט אישי, לא מעתיקים.</li>
            <li><strong>מטרה לשבוע הבא:</strong> משהו קונקרטי ומדיד.</li>
          </ul>

          <h2>דוגמה מלאה</h2>
          <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-6 text-sm leading-relaxed">
            <p><strong>תלמיד:</strong> משה כהן, כיתה ג׳ · שבוע פרשת וירא</p>
            <p><strong>גמרא:</strong> ב״מ ב-ד. הבנה טובה, זקוק לחיזוק ברש״י.</p>
            <p><strong>חומש:</strong> וירא פרקים א-ג עם רש״י. חוזר יפה.</p>
            <p><strong>מידות:</strong> מגיע בזמן, עוזר לחבר החדש. מצוין.</p>
            <p><strong>הערת הרב:</strong> משה השתתף השבוע בפתיחת המסכת בכזאת חיות שכל הכיתה שאבה ממנו.</p>
            <p><strong>מטרה:</strong> לשנן את רש״י על ב״מ ב עד יום שני.</p>
          </div>

          <h2>איך להפוך את זה לתהליך שנשאר</h2>
          <p>
            סוד ההצלחה של דו״ח שבועי — שהוא נשלח בקביעות, בערוץ אחד, בזמן שההורים
            מצפים לו. יום חמישי אחר הצהריים הוא זמן מקובל. אפשר להשתמש ב
            <Link to="/" className="text-primary hover:underline"> ClassAlign Studio </Link>
            כדי לייצר דו״ח כזה אוטומטית מהנתונים שהזנת במהלך השבוע, במקום למלא ידנית
            בכל יום חמישי. הכלי גם מייצא PDF מעוצב בעברית RTL מלאה, מוכן להדפסה
            או לשליחה בוואטסאפ.
          </p>

          <h2>שילוב עם מעקב שוטף</h2>
          <p>
            הדו״ח השבועי הוא רק אחת החוליות. יחד עם{" "}
            <Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">
              מדריך מעקב ההתקדמות
            </Link>{" "}
            הכולל, מקבלים תמונה שלמה — ובאמת רואים את הגידול של כל תלמיד.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה שהמערכת תייצר את הדו״ח בשבילך?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              התחל עם ClassAlign Studio ←
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "תמיכה — ClassAlign Studio" },
      { name: "description", content: "תמיכה למשתמשי ClassAlign Studio — שאלות נפוצות, יצירת קשר וקישורים שימושיים." },
      { property: "og:title", content: "תמיכה — ClassAlign Studio" },
      { property: "og:description", content: "תמיכה למשתמשי ClassAlign Studio — שאלות נפוצות, יצירת קשר וקישורים שימושיים." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/support" },
    ],
    links: [{ rel: "canonical", href: "https://cuddle-spark-nexus.lovable.app/support" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: "he",
          mainEntity: [
            {
              "@type": "Question",
              name: "איך מאפסים PIN שנשכח?",
              acceptedAnswer: { "@type": "Answer", text: "צא מהחשבון מהמסך הראשי, התחבר מחדש דרך המייל, ובהגדרות → אבטחה תוכל להגדיר PIN חדש." },
            },
            {
              "@type": "Question",
              name: "איך מוחקים נתוני כיתה?",
              acceptedAnswer: { "@type": "Answer", text: "בתוך כל כיתה יש כפתור מחיקה. למחיקת חשבון מלא — שלח בקשה למייל התמיכה." },
            },
            {
              "@type": "Question",
              name: "האם המידע משותף?",
              acceptedAnswer: { "@type": "Answer", text: "לא. ראה את מדיניות הפרטיות באתר." },
            },
          ],
        }),
      },
    ],
  }),
});

function SupportPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-secondary/30">
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה לעמוד הבית</Link>
        <h1 className="mt-3 font-display text-3xl font-bold">תמיכה</h1>
        <p className="mt-1 text-sm text-muted-foreground">אנחנו כאן לעזור.</p>

        <section className="mt-6 space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">פנייה ישירה</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              דוא"ל תמיכה: <a className="text-amber underline" href="mailto:nm0527603669@gmail.com">nm0527603669@gmail.com</a>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">זמן מענה ממוצע: עד 48 שעות בימי חול.</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">שאלות נפוצות</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-medium">איך מאפסים PIN שנשכח?</dt>
                <dd className="text-muted-foreground">צא מהחשבון מהמסך הראשי, התחבר מחדש דרך המייל, ובהגדרות → אבטחה תוכל להגדיר PIN חדש.</dd>
              </div>
              <div>
                <dt className="font-medium">איך מוחקים נתוני כיתה?</dt>
                <dd className="text-muted-foreground">בתוך כל כיתה יש כפתור מחיקה. למחיקת חשבון מלא — שלח בקשה למייל התמיכה.</dd>
              </div>
              <div>
                <dt className="font-medium">האם המידע משותף?</dt>
                <dd className="text-muted-foreground">לא. ראה את <Link to="/privacy" className="text-amber underline">מדיניות הפרטיות</Link>.</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
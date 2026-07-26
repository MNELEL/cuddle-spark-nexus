import { createFileRoute, Link } from "@tanstack/react-router";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/classdojo-comparison";
const TITLE = "ClassDojo מול ClassAlign Studio — השוואה למלמדים בתלמודי תורה";
const DESCRIPTION =
  "השוואה מלאה בין ClassDojo ל-ClassAlign Studio: עברית ו-RTL, מקצועות קודש, מונחי חיידר (מלמד, רב, פרשת שבוע), פרטיות, ודו״חות פדגוגיים פרטיים מול פיצ׳רים חברתיים ציבוריים.";

type Row = { feature: string; classdojo: string; classalign: string };

const ROWS: Row[] = [
  {
    feature: "שפת ממשק וכיוון קריאה",
    classdojo: "אנגלית ברירת מחדל, תרגום חלקי לעברית, לא באמת RTL",
    classalign: "עברית מלאה ו-RTL מקצה לקצה, גופן Heebo מותאם",
  },
  {
    feature: "מונחים חינוכיים",
    classdojo: "\"Teacher\", \"Student\", \"Class\" — כלליים",
    classalign: "\"הרב\", \"המלמד\", \"חיידר\", \"תלמיד\", \"פרשת שבוע\"",
  },
  {
    feature: "מקצועות ברירת מחדל",
    classdojo: "מתמטיקה, אנגלית, מדעים",
    classalign: "גמרא, משנה, חומש, נביא, הלכה, מוסר, תפילה, פרשת שבוע",
  },
  {
    feature: "מודל הפרסום להורים",
    classdojo: "פיד חברתי ציבורי (סטוריז, לייקים, תגובות)",
    classalign: "דו״ח פדגוגי פרטי — PDF שנשלח להורה בלבד",
  },
  {
    feature: "התנהגות ונקודות",
    classdojo: "נקודות פומביות מול הכיתה, אווטארים",
    classalign: "מעקב פרטי למלמד, אפשרות הצגה קבוצתית לפי בחירה",
  },
  {
    feature: "פרטיות התלמידים",
    classdojo: "שרתי ארה\"ב, פיצ׳רים חברתיים דורשים תמונה/אווטאר",
    classalign: "מינימום נתונים, שמות פנימיים, ללא תמונות תלמידים בברירת מחדל",
  },
  {
    feature: "כלים ייעודיים לחיידר",
    classdojo: "אין",
    classalign: "מחולל קבוצות, גלגל הגרלה, סאונדים, מבחנים אוטומטיים מהשיעור",
  },
  {
    feature: "ייצוא PDF ודו״חות",
    classdojo: "מוגבל למנוי בתשלום",
    classalign: "ייצוא רשימות, ציונים, סיכומי שיעור ותעודות ב-PDF כברירת מחדל",
  },
  {
    feature: "עלות למלמד בודד",
    classdojo: "חינמי עם פרסום; פיצ׳רים עיקריים בתשלום",
    classalign: "מסלול חינמי מלא לכיתה אחת, ללא פרסום",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "האם ClassDojo מתאים לתלמוד תורה או לחיידר?",
    a: "ClassDojo נבנה עבור בתי ספר אמריקאיים, עם ממשק אנגלי ופיצ׳רים חברתיים כמו סטוריז ולייקים בין הורים. הוא לא תומך בקריאה מימין לשמאל אמיתית, אין בו מקצועות קודש, והוא לא מכיר במונחים \"רב\" או \"מלמד\". לרוב המוסדות במגזר החרדי הוא לא מתאים תרבותית.",
  },
  {
    q: "מה ההבדל המרכזי בין ClassAlign ל-ClassDojo?",
    a: "ClassDojo מבוסס על פיד חברתי ציבורי בין הורים, מלמדים ותלמידים. ClassAlign מבוסס על דו״ח פדגוגי פרטי: המלמד מנהל את הכיתה, מייצר סיכומים ותעודות, ושולח אותם ישירות להורה כקובץ PDF — בלי פיד ציבורי ובלי לייקים.",
  },
  {
    q: "האם אפשר לייבא נתונים קיימים מ-ClassDojo ל-ClassAlign?",
    a: "כן. אפשר לייצא רשימת תלמידים מ-ClassDojo כ-CSV ולהעלות אותה ב\"העלאה חכמה\" של ClassAlign. המערכת מזהה שמות, כיתות ומקצועות אוטומטית וממקמת אותם במקום הנכון.",
  },
  {
    q: "האם הנתונים נשמרים בישראל?",
    a: "ClassAlign עובד עם מינימום נתונים אישיים: שמות פנימיים בלבד, ללא תמונות תלמידים כברירת מחדל, ואין העברה אוטומטית לצדדים שלישיים. ClassDojo מפעיל שרתים בארה\"ב ומאפשר פיצ׳רים חברתיים שדורשים חשיפה נוספת.",
  },
  {
    q: "האם ClassAlign תומך בהערכה במקצועות קודש?",
    a: "כן. גמרא, משנה, חומש, נביא, הלכה, מוסר, תפילה ופרשת שבוע הם מקצועות ברירת מחדל במערכת. ניתן להוסיף מקצועות משלכם, וגם הבינה המלאכותית של ClassAlign יודעת לזהות אותם בסיכומי שיעור ובתעודות.",
  },
  {
    q: "מתי בכל זאת ClassDojo יכול להתאים?",
    a: "לבתי ספר חילוניים דוברי אנגלית שמעדיפים מודל חברתי־ציבורי עם הורים פעילים בפיד, ClassDojo יכול להיות מתאים. למוסדות חרדיים שמחפשים דו״ח פרטי, עברית מלאה ומונחי חיידר — ClassAlign יתאים יותר.",
  },
];

export const Route = createFileRoute("/blog/classdojo-comparison")({
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
        }),
      },
      faqJsonLd(FAQ),
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
            ClassDojo היא אחת מהאפליקציות המוכרות בעולם לניהול כיתה, אבל היא נבנתה עבור בתי ספר
            אמריקאיים, בשפה אנגלית, ועם מודל חברתי־ציבורי בין הורים לתלמידים. במגזר החרדי, לתלמודי
            תורה וחיידרים, יש צרכים שונים: עברית מלאה, מקצועות קודש, מונחי חיידר, ודו״ח פדגוגי פרטי
            להורה — לא פיד ציבורי. ClassAlign Studio נבנה בדיוק לצורך הזה.
          </p>

          <h2>טבלת השוואה — ClassDojo מול ClassAlign Studio</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/60">
            <table className="w-full text-right text-sm">
              <thead className="bg-card/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">פיצ׳ר</th>
                  <th className="px-4 py-3 font-semibold">ClassDojo</th>
                  <th className="px-4 py-3 font-semibold">ClassAlign Studio</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r.feature} className={i % 2 === 0 ? "bg-background" : "bg-card/30"}>
                    <td className="px-4 py-3 font-medium align-top">{r.feature}</td>
                    <td className="px-4 py-3 text-muted-foreground align-top">{r.classdojo}</td>
                    <td className="px-4 py-3 text-muted-foreground align-top">{r.classalign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>למה חיידר צריך יותר מ-ClassDojo מתורגם</h2>
          <p>
            תרגום ממשק זו רק ההתחלה. חיידר או תלמוד תורה מתנהל אחרת מבית ספר אמריקאי: יש רב שמלמד
            גמרא, מלמד שמנהל את כיתה, פרשת שבוע כמקצוע שבועי, ומודל של דיווח שקט ומכובד להורים —
            לא פיד עם תגובות ולייקים. כלי שנבנה כללית מתקשה לתת מענה לזה, גם אם התפריט תורגם.
          </p>

          <h2>מודל הפרטיות: פרטי מול חברתי</h2>
          <p>
            ClassDojo בונה קהילה: הורים רואים את הפיד של הכיתה, מגיבים, ומקבלים התראות חברתיות.
            ClassAlign בונה דו״ח: המלמד מסכם, מייצר PDF ממותג עם שם המוסד והלוגו, ושולח להורה
            הספציפי. אין פיד ציבורי, אין חשיפה של תלמידים אחרים, ואין כפתור לייק.
          </p>

          <h2>מעבר מ-ClassDojo ל-ClassAlign בלי לאבד נתונים</h2>
          <p>
            אם אתם משתמשים כבר ב-ClassDojo, אפשר לייצא רשימת תלמידים כ-CSV, להעלות ב״העלאה חכמה״
            של ClassAlign, והמערכת תזהה אוטומטית את השמות, הכיתות והמקצועות. אין צורך להקליד ידנית.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה לנסות חלופה עברית לתלמוד תורה?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה ראשונה ב-ClassAlign ←
            </Link>
          </div>

          <section className="!mt-12">
            <FaqSection items={FAQ} intro="שאלות שמלמדים ומנהלי מוסדות שואלים לפני מעבר מ-ClassDojo ל-ClassAlign." />
          </section>

          <h2 className="!mt-12">מדריכים נוספים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/free-tools-comparison" className="text-primary hover:underline">השוואת כלי ניהול כיתה חינמיים למלמדים</Link></li>
            <li><Link to="/blog/classroom-management-strategies" className="text-primary hover:underline">אסטרטגיות ניהול כיתה בחיידר</Link></li>
            <li><Link to="/blog/weekly-report-template" className="text-primary hover:underline">תבנית דו״ח שבועי להורים</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}
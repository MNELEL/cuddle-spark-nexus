import { createFileRoute, Link } from "@tanstack/react-router";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";
import { RewardChartPrintView } from "@/components/reward-chart-print";
import { REWARD_CHARTS } from "@/lib/reward-charts";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/torah-study-reward-charts";
const TITLE = "לוח מבצעים ופרסים לתלמידים — מדריך ותבניות להדפסה";
const DESCRIPTION =
  "מדריך מלא להפעלת מבצעי לימוד בתלמוד תורה: לוחות מבצעים להדפסה, שיטות ניקוד, סולם פרסים לפי גיל ומעבר חלק מלוח נייר למעקב דיגיטלי בעברית.";

const CHARTS = REWARD_CHARTS;

const REWARDS = [
  { age: "כיתות א׳–ב׳", ideas: "מדבקות, חותמת בכתב יד הרב, בחירת ניגון לתפילה, הכתרה כ'חייל היום'" },
  { age: "כיתות ג׳–ד׳", ideas: "כרטיסיות אוסף, זמן משחק לימודי, מכתב שבח הביתה, ישיבה במקום נבחר" },
  { age: "כיתות ה׳–ו׳", ideas: "ספר קודש קטן, אחריות כיתתית (גבאי/חזן), מסיבת סיום מסכת קבוצתית" },
  { age: "כיתות ז׳–ח׳", ideas: "שיעור עם הרב על נושא לבחירתם, תעודת הצטיינות רשמית, יציאה לימודית" },
];

const FAQ: FaqItem[] = [
  {
    q: "מה זה 'מבצע' בתלמוד תורה ובמה הוא שונה מטבלת התנהגות רגילה?",
    a: "מבצע הוא קמפיין לימודי מוגדר בזמן — למשל חודש של משנה יומית או חזרה על מסכת — עם יעד ברור, לוח מעקב גלוי בכיתה וסולם פרסים. בניגוד לטבלת התנהגות שרצה כל השנה, למבצע יש התחלה, סיום וטקס סיום, וזה בדיוק מה שמייצר את ההתלהבות.",
  },
  {
    q: "כמה זמן כדאי שמבצע יימשך?",
    a: "בין שבועיים לחודש לכיתות הצעירות, ועד שישה שבועות לכיתות הגבוהות. מבצע ארוך מדי מאבד מתח; מבצע קצר מדי לא מספיק לייצר הרגל. שיא ההתמדה מתקבל כשיש נקודת ביניים אחת עם פרס קטן באמצע הדרך.",
  },
  {
    q: "עדיף ניקוד אישי או קבוצתי?",
    a: "שילוב. ניקוד אישי שומר על אחריות אישית, וניקוד קבוצתי מונע שתלמיד חלש 'ייפול' מהמירוץ. שיטה מומלצת: כל סימון אישי מוסיף גם נקודה לקבוצה, והפרס הגדול הוא כיתתי.",
  },
  {
    q: "איך מונעים שהפרסים יהפכו למטרה במקום הלימוד?",
    a: "מדרגים את הפרסים כלפי מטה עם הזמן ומעבירים את הדגש לפרסים של כבוד ואחריות — חזן, גבאי, מכתב לרב, תעודה. כך התמריץ החיצוני משמש כמנוע התחלה בלבד.",
  },
  {
    q: "אפשר לנהל את הלוח דיגיטלית ולא רק על הקיר?",
    a: "כן, והשילוב הוא הטוב ביותר: לוח מודפס תלוי בכיתה לנראות, ומאחוריו מעקב דיגיטלי שסופר נקודות, מציג טבלת מובילים ומפיק תעודות ופרסים אוטומטית. ב\u2011״הכיתה שלי״ יש מסך גיימיפיקציה, הגרלות ותעודות — הכול בעברית ובכיוון ימין\u2011לשמאל.",
  },
];

export const Route = createFileRoute("/blog/torah-study-reward-charts")({
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
          <span className="text-sm font-semibold">הכיתה שלי</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-invert max-w-none [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-4 [&_p]:leading-relaxed">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{TITLE}</h1>
          <p className="mt-4 text-muted-foreground">
            לוח מבצעים תלוי על קיר הכיתה הוא אחד הכלים הוותיקים והיעילים ביותר בתלמוד תורה
            ובחיידר: הוא הופך חזרה על משנה, אמירת גמרא בעל פה או הגעה בזמן לתפילה ליעד גלוי,
            מדיד ומשותף. במדריך הזה ריכזנו חמישה סוגי לוחות מוכנים להדפסה, שיטות ניקוד שעובדות,
            סולם פרסים לפי גיל — ואיך לחבר את לוח הנייר למעקב דיגיטלי בלי לוותר על הקיר.
          </p>

          <h2>למה לוח מבצעים עובד דווקא בכיתת קודש</h2>
          <p>
            שלושה מנגנונים פועלים כאן יחד: נראות (התלמיד רואה את ההתקדמות שלו בכל רגע),
            שייכות (הכיתה כולה מתקדמת לעבר יעד משותף) וטקס (סיום מבצע עם חלוקת פרסים).
            כלים גנריים כמו ClassDojo לא מדברים בשפה הזו — אין בהם מסכת, פרשה, מידות או
            סיום מבצע — ולכן רוב המלמדים חוזרים ללוח מודפס. הפתרון הנכון הוא לשמור על הלוח
            המודפס ולהוסיף מאחוריו ספירה דיגיטלית.
          </p>

          <h2>חמישה לוחות מבצעים מוכנים</h2>
          <div className="mt-6 space-y-6">
            {CHARTS.map((c) => (
              <section key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <ul className="mt-3 list-disc pr-4 text-sm text-muted-foreground">
                  <li>יעד: {c.goal}</li>
                  <li>מבנה הלוח: {c.grid}</li>
                  <li>סולם פרסים: {c.reward}</li>
                </ul>
              </section>
            ))}
          </div>

          <section className="reward-charts-print-section !mt-12">
            <div className="reward-charts-print-intro">
              <h2 className="!mt-0">תצוגת הדפסה והורדת PDF</h2>
              <p>
                בחרו לוח (או את כל החמישה), הדפיסו ישירות מהדפדפן בפורמט מותאם לדף A4,
                או הורידו קובץ PDF ממותג עם משבצות ריקות מוכנות למילוי.
              </p>
            </div>
            <RewardChartPrintView />
          </section>

          <h2>שיטת ניקוד שלא מתפרקת אחרי שבוע</h2>
          <ol className="mt-4 list-decimal pr-4 text-muted-foreground">
            <li>הגדירו יעד אחד בלבד למבצע — לא שלושה במקביל.</li>
            <li>סימון יומי קבוע באותה נקודת זמן (סוף השיעור הראשון או לפני מנחה).</li>
            <li>נקודה אישית = גם נקודה לקבוצה, כדי למנוע נשירה של תלמידים מתקשים.</li>
            <li>אל תורידו נקודות שנצברו — עונש מוחק את המוטיבציה שנבנתה.</li>
            <li>נקודת ביניים אחת עם פרס קטן באמצע התקופה.</li>
            <li>טקס סיום קצר עם הרב ותעודות מודפסות.</li>
          </ol>

          <h2>סולם פרסים לפי גיל</h2>
          <div className="mt-6 space-y-4">
            {REWARDS.map((r) => (
              <section key={r.age} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <h3 className="text-base font-semibold">{r.age}</h3>
                <p className="!mt-1 text-sm text-muted-foreground">{r.ideas}</p>
              </section>
            ))}
          </div>

          <h2>מלוח נייר למעקב דיגיטלי — בלי לוותר על הקיר</h2>
          <p>
            הדפיסו את הלוח ותלו אותו בכיתה, אבל נהלו את הספירה במקום אחד. ב-{" "}
            <Link to="/" className="text-primary hover:underline">הכיתה שלי</Link>{" "}
            מסך הגיימיפיקציה סופר נקודות אישיות וקבוצתיות, גלגל ההגרלות מחליף את פתקי
            ההגרלה בקופסה, ומחולל התעודות מפיק תעודת סיום מבצע מעוצבת בעברית עם לוגו המוסד —
            להדפסה בלחיצה אחת. כך המלמד לא סופר ידנית בסוף החודש, וההורים מקבלים תמונה מדויקת.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה להפעיל מבצע ראשון השבוע?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה והתחל לוח מבצעים ←
            </Link>
          </div>

          <section className="!mt-12">
            <FaqSection items={FAQ} intro="שאלות נפוצות ממלמדים על מבצעי לימוד ולוחות פרסים." />
          </section>

          <h2 className="!mt-12">מדריכים נוספים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/classroom-management-strategies" className="text-primary hover:underline">אסטרטגיות ניהול כיתה</Link></li>
            <li><Link to="/blog/parasha-report-templates" className="text-primary hover:underline">תבניות דף קשר לפרשת השבוע</Link></li>
            <li><Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">מעקב התקדמות תלמידים</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}

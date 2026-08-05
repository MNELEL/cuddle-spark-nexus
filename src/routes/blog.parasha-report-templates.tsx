import { blogPostHead } from "@/lib/blog-seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/parasha-report-templates";
const TITLE = "תבניות דפי קשר ודו״ח שבועי לפרשת השבוע — להדפסה";
const DESCRIPTION =
  "ספריית תבניות מוכנות להדפסה לדו״ח שבועי ולדף קשר על פרשת השבוע בתלמוד תורה — לפי גילאים, עם נוסח מוכן למלמד ולרב ואפשרות הפקה אוטומטית כ-PDF.";

const TEMPLATES = [
  {
    age: "כיתות א׳–ב׳ (גיל 6–8)",
    focus: "סיפור הפרשה, מידה טובה אחת, ציור/הדבקה",
    fields: [
      "שם הפרשה ותמונת נושא לצביעה",
      "שאלה אחת לחזרה בעל פה עם ההורים",
      "מידה טובה שבועית (למשל: הכנסת אורחים מפרשת וירא)",
      "משבצת חתימת הורה",
    ],
  },
  {
    age: "כיתות ג׳–ד׳ (גיל 8–10)",
    focus: "פסוקים, רש״י ראשון, שאלות הבנה",
    fields: [
      "שלושה פסוקי מפתח מהפרשה",
      "רש״י אחד שנלמד בכיתה + שאלה עליו",
      "טבלת חזרה יומית לחמישה ימים",
      "הערת המלמד + ציון 1–5",
    ],
  },
  {
    age: "כיתות ה׳–ו׳ (גיל 10–12)",
    focus: "פרשה + הפטרה + מוסר השכל",
    fields: [
      "סיכום קצר של הפרשה בכתב יד התלמיד",
      "קישור להפטרה ולנביא הנלמד",
      "שתי שאלות פתוחות למבחן חוזר",
      "מעקב מידות: תפילה, סדר, עזרה לחבר",
    ],
  },
  {
    age: "כיתות ז׳–ח׳ (גיל 12–14)",
    focus: "עיון, מפרשים ומעקב גמרא במקביל",
    fields: [
      "מחלוקת מפרשים אחת מהפרשה",
      "טור מקביל: דף גמרא שנלמד השבוע",
      "יעד אישי לשבוע הבא",
      "מקום להערת הרב לקראת שיחת הורים",
    ],
  },
];

const FAQ: FaqItem[] = [
  {
    q: "מה ההבדל בין ׳דף קשר׳ לבין ׳דו״ח שבועי׳?",
    a: "דף קשר הוא דף תוכן שנשלח הביתה סביב פרשת השבוע — שאלות חזרה, מידה טובה ומשימה קצרה. דו״ח שבועי הוא מסמך מעקב אישי על התלמיד: ציונים, מידות והערת המלמד. רוב תלמודי התורה שולחים את שניהם באותו יום חמישי, ולכן כדאי לשלב אותם בעמוד אחד.",
  },
  {
    q: "כל כמה זמן נכון לשלוח דף קשר להורים?",
    a: "פעם בשבוע, בקביעות, עדיף ביום חמישי. תדירות קבועה חשובה יותר מהיקף התוכן — הורה שמקבל חצי עמוד כל שבוע מעורב יותר מהורה שמקבל שלושה עמודים פעם בחודש.",
  },
  {
    q: "איך מתאימים את התבנית לגיל התלמידים?",
    a: "ככל שהגיל צעיר יותר, פחות טקסט ויותר ויזואליה: לכיתות א׳–ב׳ שאלה אחת וציור, לכיתות ה׳ ומעלה סיכום בכתב יד ושאלות פתוחות. השתמשו בטבלת התבניות שבעמוד זה כנקודת פתיחה.",
  },
  {
    q: "אפשר להפיק את הדו״ח אוטומטית במקום למלא ביד?",
    a: "כן. ב-״הכיתה שלי״ הציונים, המידות והערות המלמד נשמרים לאורך השבוע, ובלחיצה אחת מופק PDF מעוצב בעברית לכל תלמיד או לכל הכיתה — כולל לוגו המוסד. זה חוסך למלמד כשעה בשבוע.",
  },
  {
    q: "מה כדאי לכתוב בהערת המלמד?",
    a: "משפט אחד קונקרטי וחיובי, ומשפט אחד עם יעד. למשל: ״חזר יפה על רש״י של הפרשה; השבוע נתמקד בהגעה בזמן לתפילה.״ הימנעו מניסוח כללי כמו ״צריך להשתפר״.",
  },
];

export const Route = createFileRoute("/blog/parasha-report-templates")({
  component: Article,
  head: () => blogPostHead("/blog/parasha-report-templates", [faqJsonLd(FAQ)]),
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
            משוב שבועי קבוע הוא אחד הכלים החזקים ביותר בתלמוד תורה: הוא מחבר את הבית לשיעור,
            מחזק את החזרה על פרשת השבוע, ונותן לרב תמונה מסודרת לקראת שיחת הורים. הבעיה
            המוכרת היא הזמן — מילוי ידני של דף קשר לכל תלמיד גוזל שעה ויותר בכל ערב שבת.
            כאן ריכזנו תבניות מוכנות לפי גילאים, ואיך להפיק אותן אוטומטית.
          </p>

          <h2>למה משוב שבועי סביב הפרשה עובד</h2>
          <p>
            פרשת השבוע היא לוח הזמנים הטבעי של הבית החרדי. כשהדו״ח נצמד לפרשה, ההורה לא מקבל
            ״עוד טופס״ אלא נושא שהוא ממילא מדבר עליו בשולחן שבת. התוצאה: אחוזי החזרה של הדפים
            החתומים עולים משמעותית, והתלמיד חוזר על החומר פעם נוספת בלי תחושת מבחן.
          </p>

          <h2>ספריית התבניות לפי גיל</h2>
          <div className="mt-6 space-y-6">
            {TEMPLATES.map((t) => (
              <section key={t.age} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                <h3 className="text-lg font-semibold">{t.age}</h3>
                <p className="!mt-1 text-sm text-muted-foreground">מיקוד: {t.focus}</p>
                <ul className="mt-3 list-disc pr-4 text-sm text-muted-foreground">
                  {t.fields.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </section>
            ))}
          </div>

          <h2>מבנה מומלץ לדף קשר בעמוד אחד</h2>
          <ol className="mt-4 list-decimal pr-4 text-muted-foreground">
            <li>כותרת: שם המוסד, הכיתה, שם הפרשה והתאריך העברי.</li>
            <li>מה נלמד השבוע — שלוש שורות לכל היותר.</li>
            <li>שאלות חזרה להורה (2–3 שאלות קצרות).</li>
            <li>מידות ותפילה — סולם 1–5, לא ציון מספרי גבוה.</li>
            <li>הערת המלמד — משפט חיובי ומשפט יעד.</li>
            <li>חתימת הורה והחזרה ביום ראשון.</li>
          </ol>

          <h2>איך מפיקים את זה אוטומטית</h2>
          <p>
            במקום למלא ידנית, ב-{" "}
            <Link to="/" className="text-primary hover:underline">הכיתה שלי</Link>{" "}
            הציונים, המידות והערות המלמד נרשמים במהלך השבוע במסך הכיתה, ומחולל ה-PDF מפיק דו״ח
            שבועי מעוצב בעברית — לתלמיד בודד או לכיתה שלמה — כולל לוגו המוסד וכיוון ימין־לשמאל
            תקין. אותה מערכת מפיקה גם תעודות ודו״ח פדגוגי לרב.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה להפסיק למלא דפי קשר ביד?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה והפק דו״ח שבועי ראשון ←
            </Link>
          </div>

          <section className="!mt-12">
            <FaqSection items={FAQ} intro="שאלות נפוצות ממלמדים על דפי קשר ודו״חות שבועיים." />
          </section>

          <h2 className="!mt-12">מדריכים נוספים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/weekly-report-template" className="text-primary hover:underline">תבנית דו״ח שבועי לתלמיד</Link></li>
            <li><Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">מדריך למעקב אחר התקדמות תלמידים</Link></li>
            <li><Link to="/parents-guide" className="text-primary hover:underline">מרכז המשאבים להורים</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}
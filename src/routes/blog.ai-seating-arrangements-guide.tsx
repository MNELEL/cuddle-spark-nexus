import { createFileRoute, Link } from "@tanstack/react-router";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL_ = "https://cuddle-spark-nexus.lovable.app/blog/ai-seating-arrangements-guide";
const TITLE = "סידורי ישיבה חכמים עם AI — מדריך ניהול כיתה גדולה בחיידר";
const DESCRIPTION =
  "מדריך מקצועי למלמדים ורבנים: איך להשתמש ב-AI Sort לבניית סידורי ישיבה שמפחיתים הפרעות ומשפרים ריכוז בכיתה גדולה בתלמוד תורה, במקום שעות עבודה ידנית.";

const FAQ: FaqItem[] = [
  {
    q: "מהו AI Sort ואיך הוא בונה סידור ישיבה?",
    a: "AI Sort הוא כלי ב"הכיתה שלי" שמנתח את הרכב הכיתה — התנהגות, ריכוז, קשרים חברתיים והישגים במקצועות קודש — ובונה סידור ישיבה מיטבי בכמה שניות. הוא מפזר תלמידים מפריעים, מקרב תלמידים חלשים למובילים, ושומר על איזון קבוצתי.",
  },
  {
    q: "האם זה עובד לכיתה גדולה של 30–40 תלמידים?",
    a: "כן. דווקא בכיתות גדולות היתרון מורגש: במקום להזיז ידנית 40 שמות על גבי לוח, AI Sort בונה מספר תרחישים ומאפשר למלמד לבחור, לנעול תלמידים ספציפיים במקום, ולבצע Undo מיידי אם התוצאה לא מתאימה.",
  },
  {
    q: "האם המלמד שומר שליטה על הסידור?",
    a: "בהחלט. AI Sort הוא הצעה — לא גזרת גורל. אפשר לגרור תלמיד למקום אחר, לנעול צמדים, ולסמן חוקים כמו \"לא לשים את X ליד Y\". הרב תמיד מאשר סופית.",
  },
  {
    q: "האם הסידור מתעדכן לאורך השנה?",
    a: "כן. הכיתה שלי לומדת מדפוסי התנהגות שנרשמו לאורך זמן, וכשמצב הכיתה משתנה — תלמיד חדש, שינוי בהתנהגות, קבוצת חברותא חדשה — AI Sort מציע התאמה מחודשת בלחיצה.",
  },
  {
    q: "מה ההבדל בין AI Sort לבין גרירה ידנית של שמות?",
    a: "גרירה ידנית לוקחת 30–60 דקות ומבוססת על תחושת בטן. AI Sort לוקח 5 שניות, מבוסס על נתוני התנהגות אמיתיים מהמעקב היומי, ומייצר תוצאה מנומקת שאפשר להסביר להורים או להנהלה.",
  },
  {
    q: "האם הסידור נשמר ומודפס?",
    a: "כן. כל סידור נשמר בהיסטוריה, אפשר לייצא PDF ממותג עם שם המוסד והלוגו, לתלות בכיתה או לשתף עם המנהל.",
  },
];

export const Route = createFileRoute("/blog/ai-seating-arrangements-guide")({
  component: Article,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL_ },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL_ }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          inLanguage: "he",
          mainEntityOfPage: URL_,
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
            סידור ישיבה בכיתה גדולה הוא אחת המשימות שגוזלות למלמד הכי הרבה זמן — ומייצרות הכי הרבה
            ויכוחים. מי יושב ליד מי? איפה מציבים את התלמיד שמפריע? איך יוצרים איזון בין תלמידים חזקים
            לחלשים בגמרא? המדריך הזה מראה איך AI Sort ב"הכיתה שלי" מטפל בכל זה תוך שניות — בלי לוותר
            על שיקול הדעת של הרב.
          </p>

          <h2>הבעיה: 40 שמות על לוח מחיק</h2>
          <p>
            במלמדים רבים ראינו את אותה שגרה: יום ראשון בבוקר, לוח מחיק, מגנטים עם שמות תלמידים,
            ושעה שלמה של הזזות. אחרי חצי שנה גם הסידור הכי מתוחכם מפסיק לעבוד — כי הכיתה זזה,
            תלמידים מתחברים בקבוצות חדשות, וההפרעות משתנות. סידור ידני הוא תמונת מצב סטטית של
            כיתה דינמית.
          </p>

          <h2>הפתרון: AI Sort כמנוע החלטה, לא כמחליף</h2>
          <p>
            AI Sort ב"הכיתה שלי" מנתח שלושה שכבות נתונים: (1) התנהגות יומית — מי הפריע, מי התרכז,
            מי היה שקט; (2) הישגים במקצועות קודש — מי צריך חברותא חזקה בגמרא; (3) העדפות שהמלמד
            הגדיר — למשל "אין לשים את שמעון ולוי באותה שורה". התוצאה: הצעת סידור מנומקת שהמלמד
            יכול לאשר, לערוך או לזרוק.
          </p>

          <h2>חמישה עקרונות לסידור ישיבה מבוסס התנהגות</h2>
          <ol className="mt-4 list-decimal pr-6 space-y-2">
            <li><strong>פיזור מוקדי הפרעה</strong> — לא לסמוך על תחושת בטן; הנתונים מראים מי משפיע על מי.</li>
            <li><strong>חברותא מאוזנת</strong> — תלמיד חזק בגמרא צמוד לתלמיד שצריך חיזוק, לא לתלמיד ברמתו.</li>
            <li><strong>קרבה לרב לצורך ריכוז</strong> — התלמידים שנפגעים מריכוז יושבים בשורה הראשונה כברירת מחדל.</li>
            <li><strong>נעילת צמדים חיוביים</strong> — כשמזהים כימיה טובה בין שני תלמידים, נועלים אותם ולא נותנים ל-AI לשנות.</li>
            <li><strong>רוטציה חודשית</strong> — סידור סטטי גורם לשעמום; רוטציה שומרת על ערנות בלי לפרק את מה שעובד.</li>
          </ol>

          <h2>איך משתמשים ב-AI Sort — צעד אחר צעד</h2>
          <ol className="mt-4 list-decimal pr-6 space-y-2">
            <li>נכנסים לכיתה במסך <Link to="/" className="text-primary hover:underline">הכיתה שלי</Link> ופותחים את תצוגת ה-Grid.</li>
            <li>לוחצים על <strong>AI Sort</strong>. המערכת שואלת מה המטרה: הפחתת הפרעות / חיזוק אקדמי / איזון קבוצתי.</li>
            <li>מקבלים הצעת סידור עם הסבר קצר לכל מיקום ("שמואל הועבר לשורה 1 בגלל 8 אירועי הפרעה השבוע").</li>
            <li>גוררים ידנית תלמידים שרוצים לשנות, נועלים צמדים, ולוחצים <strong>שמור</strong>.</li>
            <li>מייצאים PDF ממותג ותולים בכיתה, או שולחים למנהל לאישור.</li>
          </ol>

          <h2>שליטה מלאה: Undo, נעילה, וכללי בית</h2>
          <p>
            AI Sort אף פעם לא משתלט על ההחלטה. יש כפתור Undo מלא, אפשרות לנעול תלמיד במקום ספציפי,
            ומנגנון "כללים" קבועים — למשל "תמיד להושיב את יוסי ליד החלון" או "לא לצרף את הקבוצה
            החדשה שהגיעה השנה עם הוותיקים בשבוע הראשון". הרב קובע; ה-AI מציע.
          </p>

          <h2>מדידה: איך יודעים שזה עובד</h2>
          <p>
            אחרי כל סידור, הכיתה שלי עוקבת אחרי אירועי ההפרעה בשבועיים הבאים ומשווה לתקופה שלפני
            הסידור. אם המספרים ירדו — הסידור עבד. אם עלו — AI Sort יציע התאמה. כך הופכים ניחוש
            לתהליך מדיד.
          </p>

          <div className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="text-sm text-muted-foreground">רוצה לבנות סידור ישיבה חכם לכיתה שלך?</p>
            <Link to="/" className="mt-2 inline-block text-base font-semibold text-primary hover:underline">
              פתח כיתה והפעל AI Sort ←
            </Link>
          </div>

          <section className="!mt-12">
            <FaqSection items={FAQ} intro="שאלות נפוצות ממלמדים על סידור ישיבה מבוסס AI בתלמוד תורה." />
          </section>

          <h2 className="!mt-12">מדריכים נוספים</h2>
          <ul className="mt-4 list-disc pr-4">
            <li><Link to="/blog/classroom-management-strategies" className="text-primary hover:underline">אסטרטגיות ניהול כיתה בחיידר</Link></li>
            <li><Link to="/blog/classroom-tools-teachers" className="text-primary hover:underline">10 כלי הוראה חינמיים לכל מלמד</Link></li>
            <li><Link to="/blog/progress-tracking-guide" className="text-primary hover:underline">מעקב התקדמות תלמידים — מדריך מלא</Link></li>
          </ul>
        </article>
      </main>
    </div>
  );
}
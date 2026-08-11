import { socialImageMeta } from "@/lib/social-meta";
import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "מדיניות תוכן וסינון — הכיתה שלי";
const DESC =
  "מדיניות התוכן של הכיתה שלי: אתר ניהול כיתה לתלמודי תורה וחיידרים — ללא פרסומות, ללא תוכן חופשי מהאינטרנט, ובהתאמה לכללי סינון תורניים.";

export const Route = createFileRoute("/content-policy")({
  component: ContentPolicyPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://hakitasheli.lovable.app/content-policy" },
      ...socialImageMeta(),
    ],
    links: [{ rel: "canonical", href: "https://hakitasheli.lovable.app/content-policy" }],
  }),
});

function ContentPolicyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-secondary/30">
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה לעמוד הבית</Link>
        <h1 className="mt-3 font-display text-3xl font-bold">מדיניות תוכן וסינון</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          עדכון אחרון: 10 באוגוסט 2026 · עמוד זה נכתב ומתוחזק על-ידי בעל המערכת "הכיתה שלי".
        </p>

        <section className="prose prose-sm mt-6 max-w-none space-y-4 text-foreground">
          <h2 className="font-display text-xl font-semibold">נושא האתר</h2>
          <p>
            "הכיתה שלי" הוא כלי ניהול כיתה שנבנה במיוחד עבור תלמודי תורה, חיידרים
            ובתי ספר. האתר מיועד למלמדים, לרבנים ולהנהלות מוסדות, ומשמש לעבודה פדגוגית שוטפת בלבד:
          </p>
          <ul>
            <li>רשימות תלמידים, סידור הושבה בכיתה ומעקב נוכחות.</li>
            <li>מעקב התנהגות, נקודות, יעדים והישגים בלימודי קודש (גמרא, משנה, חומש, נביא, הלכה, מוסר).</li>
            <li>לוח צלצולים, מערכת שעות, לוח שנה עברי עם פרשת השבוע ותורנויות.</li>
            <li>הפקת דוחות, תעודות, מסמכי מסירה בין מלמדים ותקשורת יזומה עם ההורים.</li>
            <li>ספריית חומרי הוראה שהמוסד או המלמד מעלים לעצמם.</li>
            <li>בלוג הדרכה וכלים חינמיים בנושאי ניהול כיתה והוראה תורנית.</li>
          </ul>

          <h2 className="font-display text-xl font-semibold">התחייבות להתאמה לכללי סינון תורניים</h2>
          <p>
            אנו מתחייבים שהתוכן באתר יתאים לכללי התוכן של גופי הסינון התורניים (נטפרי ודומיו).
            בפרט:
          </p>
          <ul>
            <li>אין באתר ואין יעד להוסיף תוכן פריצות, בידור, מוזיקה, וידאו או תמונות בעייתיות.</li>
            <li>אין באתר פרסומות, באנרים או רשתות מודעות חיצוניות מכל סוג.</li>
            <li>אין מנוע חיפוש חופשי באינטרנט, ואין דפדוף או צפייה בתוכן מאתרים חיצוניים מתוך האתר.</li>
            <li>אין פורומים, צ׳אט פתוח, תגובות ציבוריות, פרופילים ציבוריים או מנגנון היכרות/מסרים בין גולשים.</li>
            <li>איננו מפעילים העלאת תמונות או קבצים לצפייה ציבורית פתוחה.</li>
            <li>יצירת תוכן בעזרת AI מוגבלת לטיוטות פדגוגיות (מטלות, סיכומים, דוחות) בהוראת המשתמש המחובר, והתוצר נשמר בחשבונו — לא בדף ציבורי.</li>
          </ul>

          <h2 className="font-display text-xl font-semibold">מה ציבורי ומה סגור</h2>
          <p>
            רוב האתר סגור מאחורי התחברות אישית, וכל שורת מידע מוגנת בהרשאות ברמת הרשומה. הדפים
            הציבוריים הם דפי תוכן שלנו (עמוד הבית, בלוג, מדריכים, עמודי עזרה, כלים חינמיים) —
            תוכן שנכתב על-ידינו ונבדק לפני פרסום.
          </p>
          <p>
            בנוסף קיימות שתי כתובות שיתוף לשימוש המוסד: דף כיתה בכתובת <code>/c/…</code> ודוח הורים
            אישי בכתובת <code>/p/…</code> עם קישור-אסימון. הדפים הללו מציגים רק נתונים לימודיים
            שהמלמד עצמו הזין (הישגים, נקודות, הודעות כיתה), אינם מאפשרים לגולש להעלות תוכן, אינם
            מכילים תמונות שהועלו על-ידי גולשים, והם חסומים לאינדוקס במנועי החיפוש
            (<code>robots.txt</code>). האחריות התוכנית עליהם היא של המוסד, והם כפופים למדיניות זו.
          </p>

          <h2 className="font-display text-xl font-semibold">פיקוח ואכיפה</h2>
          <ul>
            <li>תוכן שיווקי ותוכן הבלוג נכתב ונבדק על-ידינו בלבד; אין פרסום אוטומטי של תוכן גולשים.</li>
            <li>שימוש שאינו הולם, או העלאת חומר שאינו מתאים לרוח מוסדות תורניים, מהווה הפרת תנאי השימוש ומוביל לחסימת החשבון והסרת התוכן.</li>
            <li>קישורים חיצוניים נוספים לאתר רק לאחר בדיקה, ומוגבלים לצרכים תפעוליים (למשל שירותי המוסד עצמו).</li>
            <li>אנו מתחייבים להיענות לפניית גוף סינון בנוגע לכתובת מסוימת ולתקן או להסיר תוכן בהתאם.</li>
          </ul>

          <h2 className="font-display text-xl font-semibold">יצירת קשר</h2>
          <p>
            לכל שאלה בנושא תוכן וסינון, או לדיווח על תוכן שאינו מתאים, ניתן לפנות דרך
            <Link to="/support" className="text-amber underline"> עמוד התמיכה</Link>. ראו גם את
            <Link to="/privacy" className="text-amber underline"> מדיניות הפרטיות</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
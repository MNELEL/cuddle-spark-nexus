import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "מדיניות פרטיות — ClassAlign Studio" },
      { name: "description", content: "מדיניות הפרטיות של ClassAlign Studio — איזה מידע נאסף, איך הוא נשמר ומה הזכויות שלך." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-secondary/30">
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← חזרה לעמוד הבית</Link>
        <h1 className="mt-3 font-display text-3xl font-bold">מדיניות פרטיות</h1>
        <p className="mt-1 text-sm text-muted-foreground">עדכון אחרון: 21 ביוני 2026 · עמוד זה נכתב ומתוחזק על-ידי בעל האפליקציה ClassAlign Studio.</p>

        <section className="prose prose-sm mt-6 max-w-none space-y-4 text-foreground">
          <h2 className="font-display text-xl font-semibold">מי אנחנו</h2>
          <p>
            ClassAlign Studio הוא כלי ניהול כיתה לחיידרים, תלמודי תורה ובתי ספר, המסייע למלמדים ולרבנים
            לתעד נוכחות, התנהגות, הישגים ותקשורת עם הורים.
          </p>

          <h2 className="font-display text-xl font-semibold">איזה מידע אנו אוספים</h2>
          <ul>
            <li>פרטי חשבון: כתובת אימייל לצורך התחברות בלבד.</li>
            <li>נתוני כיתה שאתה מזין: שמות תלמידים, ציונים, נקודות התנהגות, הערות.</li>
            <li>קבצים שאתה מעלה (משאבי הוראה, מסמכי תלמיד).</li>
            <li>הגדרות אבטחה לוקאליות (PIN מוצפן בלבד — אנו לא רואים את הקוד עצמו).</li>
          </ul>

          <h2 className="font-display text-xl font-semibold">איך המידע נשמר</h2>
          <p>
            הנתונים נשמרים בענן מאובטח (Lovable Cloud מבוסס Supabase) עם הצפנה בתעבורה (TLS) ובדיסק.
            כל שורה מוגנת בכללי Row-Level Security כך שרק אתה רואה את המידע שלך.
          </p>

          <h2 className="font-display text-xl font-semibold">שיתוף עם צד שלישי</h2>
          <p>
            איננו מוכרים מידע. שיתוף מתבצע רק לקבלני שירות הכרחיים (אחסון בענן, ספק AI ליצירת טיוטות).
            תוכן שאתה מייצא ושולח (למשל מייל להורים) יוצא מהאפליקציה לפי בחירתך בלבד.
          </p>

          <h2 className="font-display text-xl font-semibold">זכויותיך</h2>
          <p>
            אתה רשאי לצפות, לעדכן או למחוק את הנתונים שלך בכל עת מתוך האפליקציה, או על-ידי בקשה
            לדוא"ל התמיכה.
          </p>

          <h2 className="font-display text-xl font-semibold">יצירת קשר</h2>
          <p>
            לשאלות פרטיות, פנה לכתובת התמיכה המופיעה ב<Link to="/support" className="text-amber underline">עמוד התמיכה</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
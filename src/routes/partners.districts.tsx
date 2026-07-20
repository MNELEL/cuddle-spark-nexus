import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, BarChart3, ShieldCheck, Users, FileText, Mail, Download, CheckCircle2 } from "lucide-react";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL_SELF = "https://cuddle-spark-nexus.lovable.app/partners/districts";

const FAQ: FaqItem[] = [
  {
    q: "כמה מוסדות מינימום נדרש כדי לקבל רישיון מחוזי?",
    a: "רישוי מחוזי מתחיל מ-3 מוסדות. עבור רשתות של 10+ מוסדות יש חבילת Enterprise עם מנהל חשבון ייעודי ותמיכה מועדפת.",
  },
  {
    q: "האם אפשר להטמיע ברשת מוסדות שכל מוסד עובד בשיטה שונה?",
    a: "כן. כל מוסד ברשת מקבל תצורה עצמאית (תבניות, מקצועות, סגנון AI), בעוד שהמטה רואה דוחות אגרגטיביים אחידים. זה הגישה המומלצת לרשתות חדשות.",
  },
  {
    q: "מה מכיל לוח הבקרה המחוזי?",
    a: "השוואה בין מוסדות על יעדי דפים, נוכחות, מעורבות הורים, ואחוז דוחות שנשלחו בזמן. אפשר לפלטר לפי שכבת גיל, סוג מוסד או אזור גיאוגרפי.",
  },
  {
    q: "האם יש אינטגרציה עם מערכות ניהול בית ספר קיימות?",
    a: "יש תמיכה בייבוא/ייצוא CSV, וכן אינטגרציות SSO. עבור מערכות ייחודיות של רשתות אנחנו בונים מחבר מותאם במסגרת חבילת ה-Enterprise.",
  },
  {
    q: "מה לוח הזמנים לפריסה בכל המוסדות?",
    a: "0-30 יום פיילוט ב-2-3 מוסדות, 31-60 יום הרחבה לחצי מהמוסדות, 61-90 יום פריסה מלאה. תוכנית 90 יום מפורטת מופיעה בעמוד עצמו.",
  },
  {
    q: "האם התמחור המחוזי כולל תמיכה והדרכה בכל המוסדות?",
    a: "כן. הרישוי המחוזי כולל סדנאות לכל המלמדים ברשת, תמיכה בעברית בימי א׳-ה׳, מנהל חשבון ייעודי, ועדכונים לאורך השנה — ללא עלות נוספת.",
  },
];

export const Route = createFileRoute("/partners/districts")({
  component: DistrictsPage,
  head: () => ({
    meta: [
      { title: "פתרון מחוזי למחוזות חינוך ורשתות | ClassAlign" },
      { name: "description", content: "ClassAlign למחוזות חינוך ורשתות מוסדות: לוח בקרה מחוזי, דוחות אגרגטיביים, הטמעה מרוכזת ורישוי בהיקף. תוכנית 90 יום ואיש קשר ייעודי." },
      { property: "og:title", content: "פתרון מחוזי · ClassAlign למחוזות חינוך" },
      { property: "og:description", content: "לוח בקרה מחוזי, דוחות אגרגטיביים, ורישוי מוסדי לרשתות חינוך." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [faqJsonLd(FAQ)],
  }),
});

function DistrictsPage() {
  const features = [
    { icon: BarChart3, title: "לוח בקרה מחוזי", body: "מדדים אגרגטיביים על פני עשרות מוסדות: התקדמות פדגוגית, נוכחות ומעורבות הורים." },
    { icon: ShieldCheck, title: "אבטחה ותאימות", body: "RLS מלא, PIN למכשירים משותפים, יומני ביקורת ואיזור נתונים ישראלי." },
    { icon: Users, title: "ניהול משתמשים מרוכז", body: "SSO, קבוצות הרשאה לפי מוסד ותפקיד, וסנכרון עם מערכות ניהול קיימות." },
    { icon: FileText, title: "דיווח לפיקוח", body: "הפקת דוחות עמידה ברגולציה בלחיצה — כולל אישורי הורים ומסמכי פרטיות." },
  ];

  const timeline = [
    { phase: "0–30 יום", items: ["פגישת הכרות עם מטה המחוז", "הגדרת מוסדות פיילוט", "הדרכת מנהלים ורכזי טכנולוגיה"] },
    { phase: "31–60 יום", items: ["הרחבה לכלל המלמדים בפיילוט", "אינטגרציה עם מערכות קיימות", "סקירת דוחות ראשונים"] },
    { phase: "61–90 יום", items: ["פריסה מלאה למחוז", "העברת מדדי הצלחה", "בניית תוכנית שנתית"] },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link to="/partners" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> חזרה לשיתופי פעולה
          </Link>
        </div>
      </header>

      <main className="container mx-auto py-12 space-y-14">
        <section className="text-center max-w-3xl mx-auto">
          <Building2 className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">פתרון מחוזי לרשתות חינוך</h1>
          <p className="text-lg text-muted-foreground">
            ClassAlign מספקת למחוזות חינוך ולרשתות מוסדות תשתית ניהול כיתה אחידה, עם לוח בקרה
            מחוזי, דוחות אגרגטיביים, וכלים פדגוגיים בקדושת המקצוע — כל זאת תחת רישוי מוסדי אחד.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="mailto:partners@classalign.app?subject=פנייה%20ממחוז%20חינוך">
              <Button size="lg" className="gap-2"><Mail className="h-4 w-4" /> קביעת פגישת הכרות</Button>
            </a>
            <a href="/downloads/classalign-implementation-guide.html" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="gap-2"><Download className="h-4 w-4" /> מסמך הטמעה</Button>
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="h-6 w-6 text-primary mb-1" />
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{body}</CardContent>
            </Card>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">תוכנית פריסה ל-90 יום</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {timeline.map(({ phase, items }) => (
              <Card key={phase}>
                <CardHeader>
                  <CardTitle className="text-primary">{phase}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {items.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <FaqSection items={FAQ} intro="שאלות שאנחנו שומעים ממטות מחוזיים וממנהלי רשתות חינוך." />
      </main>
    </div>
  );
}

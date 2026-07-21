import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, School, BookOpen, Sparkles, Users, Mail, Download, CheckCircle2 } from "lucide-react";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL_SELF = "https://cuddle-spark-nexus.lovable.app/partners/schools";

const FAQ: FaqItem[] = [
  {
    q: "האם רישיון מוסדי אחד מכסה את כל המלמדים במוסד?",
    a: "כן. הרישיון המוסדי הוא שנתי וכולל את כל המלמדים והכיתות במוסד — ללא הגבלה על מספר משתמשים. גם צוות ההנהלה והמזכירות מקבל גישה.",
  },
  {
    q: "האם אפשר להתחיל עם כיתה אחת לפני הטמעה מלאה?",
    a: "בהחלט. אנחנו ממליצים על פיילוט של 2-3 מלמדים בשבועיים הראשונים, ואז הרחבה לכלל המוסד. הפיילוט לא דורש התחייבות שנתית.",
  },
  {
    q: "מה קורה אם רב או מלמד לא רגיל עם טכנולוגיה?",
    a: "המערכת נבנתה כדי להיות פשוטה גם לרבנים ומלמדים מבוגרים. יש סדנאות פרונטליות בעברית, מדריכי וידאו קצרים, וקליטת ציונים בקול או בצילום דף — בלי צורך להקליד.",
  },
  {
    q: "האם התבניות תואמות לזרם החינוכי שלנו (ליטאי/חסידי/ספרדי/ממ״ד)?",
    a: "יש תבניות ברירת מחדל לכל זרם, ואפשר להתאים לחלוטין את מונחי הקודש, סגנון העלון, וטופסי הדוחות לרוח המוסד. פרופיל ה-AI לומד את הסגנון מהחומרים שהמלמד עורך.",
  },
  {
    q: "מה קורה בסוף שנה — האם הנתונים נשמרים?",
    a: "כל הנתונים ההיסטוריים נשמרים בגיבוי מלא. תלמידים עולים לכיתה הבאה, וההיסטוריה נגישה למחנך החדש. אפשר גם לייצא את כל הנתונים בפורמט PDF או Excel בכל זמן.",
  },
  {
    q: "האם יש אפשרות תשלום חודשי במקום שנתי?",
    a: "הרישיון המוסדי הוא שנתי — זה מאפשר לנו לספק הדרכה מלאה ותמיכה לכל השנה. עבור מוסדות קטנים או פיילוט קצר, יש תוכנית חודשית מוגבלת. פרטים בפנייה.",
  },
];

export const Route = createFileRoute("/partners/schools")({
  component: SchoolsPage,
  head: () => ({
    meta: [
      { title: "רישיון מוסדי לבתי ספר, חיידרים ותלמודי תורה | ClassAlign" },
      { name: "description", content: "ClassAlign למוסד יחיד: רישיון שנתי לכל המלמדים, סדנאות הדרכה בעברית, תבניות סדר יום, וסנכרון עם המזכירות. מותאם לחיידר, תלמוד תורה ובית ספר." },
      { property: "og:title", content: "רישיון מוסדי · ClassAlign לבתי ספר וחיידרים" },
      { property: "og:description", content: "רישיון מוסדי כולל הדרכה, תבניות ותמיכה טכנית לאורך שנת הלימודים." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [faqJsonLd(FAQ)],
  }),
});

function SchoolsPage() {
  const features = [
    { icon: BookOpen, title: "תבניות מקצועות קודש", body: "סדרי יום מוכנים לגמרא, משנה, חומש והלכה — מותאמים לגילאים ולזרם החינוכי." },
    { icon: Sparkles, title: "AI בקול המוסד", body: "עלונים, מבחנים וסיכומים בשפה, הסגנון והמונחים שהמוסד רגיל אליהם." },
    { icon: Users, title: "הדרכת מלמדים", body: "3 סדנאות פרונטליות/וירטואליות + מדריך וידאו + סיוע בהעלאת רשימות שמות." },
    { icon: School, title: "ניהול מוסדי", body: "משתמש מנהל, ניהול כיתות, יומני ביקורת, ומסך בקרה למנהל המוסד." },
  ];

  const included = [
    "רישיון שנתי לכל המלמדים במוסד",
    "פרופיל AI מותאם לרוח המוסד",
    "תבניות עלון שבועי, אישור הורים ותעודות",
    "יבוא רשימות שמות מ-Excel/CSV/צילום",
    "תמיכה טכנית בעברית בימי א׳-ה׳",
    "עדכונים ופיצ׳רים חדשים לאורך השנה",
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
          <School className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">רישיון מוסדי לבית הספר או החיידר</h1>
          <p className="text-lg text-muted-foreground">
            רישיון מוסדי אחד לכל המלמדים במוסד — כולל הדרכה, תבניות מוכנות בקדושת המקצוע, ותמיכה
            אישית לאורך כל שנת הלימודים.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="mailto:nm0527603669@gmail.com?subject=רישיון%20מוסדי">
              <Button size="lg" className="gap-2"><Mail className="h-4 w-4" /> בקשת הצעת מחיר</Button>
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

        <section className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">מה כלול ברישיון המוסדי</h2>
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {included.map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <FaqSection items={FAQ} intro="שאלות נפוצות ממנהלי מוסדות, רבנים, ומחנכות." />
      </main>
    </div>
  );
}

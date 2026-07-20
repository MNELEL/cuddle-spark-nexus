import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, School, GraduationCap, Handshake, FileText, ShieldCheck, Users, Sparkles, ArrowLeft, Download, Mail } from "lucide-react";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";

const URL_SELF = "https://cuddle-spark-nexus.lovable.app/partners";

const FAQ: FaqItem[] = [
  {
    q: "האם ClassAlign מתאים לחיידרים ותלמודי תורה, ולא רק לבתי ספר?",
    a: "כן. המערכת נבנתה מלכתחילה לקהל היעד החרדי — מונחי גמרא, משנה וחומש, ממשק RTL מלא, תבניות עלון בסגנון תלמוד תורה, וסידורים לר״מים ולמשגיחים. יש רשימת מקצועות קודש ברירת מחדל שאפשר להתאים לרוח המוסד.",
  },
  {
    q: "מה תהליך ההטמעה למוסד חדש?",
    a: "מפגש הכרות (30 דק׳), ייבוא רשימות בחורים/תלמידים מ-Excel או צילום, שתי סדנאות למלמדים, וליווי אישי ב-90 הימים הראשונים. תוכנית מלאה מופיעה בעמוד Case Studies.",
  },
  {
    q: "כמה זמן לוקח להטמיע במוסד עם 20 מלמדים?",
    a: "פיילוט עם 3-5 מלמדים תוך שבוע, פריסה מלאה תוך 3-6 שבועות. תוכנית 90 יום כוללת מדידת תוצאות ובניית תוכנית עבודה שנתית.",
  },
  {
    q: "האם המערכת עומדת בדרישות פרטיות של משרד החינוך?",
    a: "כן. RLS מלא על כל טבלה, PIN למכשירים משותפים, יומני ביקורת, ואחסון נתונים באזור מוגן. אפשר לקבל טופס אישור הורים לדוגמה ומסמך אבטחת מידע מלא.",
  },
  {
    q: "האם יש רישיון מיוחד למחוזות ורשתות של מספר מוסדות?",
    a: "כן. רישוי מוסדי אחד כולל הנחות היקף, לוח בקרה מחוזי לדוחות אגרגטיביים, מנהל חשבון ייעודי, וחשבוניות מרוכזות. פרטים בעמוד /partners/districts.",
  },
  {
    q: "האם ה-AI לומד את סגנון הכתיבה של הרב או המלמד?",
    a: "כן. פרופיל סגנון אישי (Teacher Style Profile) לומד מטקסטים שהמלמד עורך — מונחים, אורך משפט, סגנון פנייה — ומזין את זה אל תבניות העלון, המבחן והסיכום.",
  },
  {
    q: "מה עלות הרישיון ומה כלול בו?",
    a: "התמחור לפי מספר כיתות/מלמדים ולפי סוג המוסד (מוסד יחיד או רשת). הרישיון כולל את כל הפיצ׳רים, הדרכה, תמיכה בעברית, ועדכונים לאורך השנה. צרו קשר לקבלת הצעת מחיר מותאמת.",
  },
];

export const Route = createFileRoute("/partners")({
  component: PartnersPage,
  head: () => ({
    meta: [
      { title: "שיתופי פעולה למחוזות חינוך ובתי ספר | ClassAlign" },
      { name: "description", content: "תוכנית שיתופי פעולה של ClassAlign למחוזות חינוך, רשתות חינוך ובתי ספר: הטמעה מרוכזת, הדרכת צוותים, ומסמכי דוגמה להכנסה מהירה לכיתות." },
      { property: "og:title", content: "שיתופי פעולה למחוזות חינוך ובתי ספר · ClassAlign" },
      { property: "og:description", content: "פתרון ניהול כיתה חכם למחוזות ובתי ספר, כולל הטמעה מרוכזת, הדרכה, ומסמכי דוגמה." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "ClassAlign Partnerships",
          serviceType: "Educational technology partnership",
          provider: { "@type": "Organization", name: "ClassAlign Studio" },
          areaServed: "IL",
          audience: {
            "@type": "EducationalAudience",
            educationalRole: ["school", "district", "administrator"],
          },
          url: URL_SELF,
        }),
      },
      faqJsonLd(FAQ),
    ],
  }),
});

function PartnersPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> חזרה לעמוד הבית
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm">כניסה למערכת</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto py-12 space-y-16">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm mb-4">
            <Handshake className="h-4 w-4" /> תוכנית שיתופי פעולה
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            ClassAlign למחוזות חינוך, רשתות ובתי ספר
          </h1>
          <p className="text-lg text-muted-foreground">
            אנו מלווים מחוזות חינוך, רשתות מוסדות ובתי ספר בהטמעה מרוכזת של ClassAlign — עם הדרכה
            מקצועית לצוות, הגדרות מותאמות לרוח המוסד, ומסמכי דוגמה להכנסה חלקה של הכלי לכיתות
            הגמרא, המשנה והחומש.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="mailto:partners@classalign.app?subject=בקשת%20שיתוף%20פעולה">
              <Button size="lg" className="gap-2"><Mail className="h-4 w-4" /> בקשת שיחת הכרות</Button>
            </a>
            <a href="/downloads/classalign-implementation-guide.html" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="gap-2"><Download className="h-4 w-4" /> מסמך הטמעה לדוגמה</Button>
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Link to="/partners/districts" className="group">
            <Card className="h-full transition hover:border-primary hover:shadow-lg">
              <CardHeader>
                <Building2 className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-2xl">מחוזות חינוך ורשתות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>הטמעה רב-מוסדית עם ניהול מרכזי, דוחות אגרגטיביים ותקציב שנתי מתואם.</p>
                <div className="text-primary text-sm group-hover:underline">קראו על הפתרון המחוזי ←</div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/partners/schools" className="group">
            <Card className="h-full transition hover:border-primary hover:shadow-lg">
              <CardHeader>
                <School className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-2xl">בתי ספר, חיידרים ותלמודי תורה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>רישיון מוסדי עם הדרכה למלמדים, תבניות סדר יום, וסנכרון עם המזכירות.</p>
                <div className="text-primary text-sm group-hover:underline">קראו על הפתרון למוסד ←</div>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section className="mb-12">
          <Link to="/partners/case-studies" className="group block">
            <Card className="transition hover:border-primary hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Case Studies — סיפורי הטמעה אמיתיים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>ישיבה קטנה, רשת תלמודי תורה ובית ספר ממ״ד — יעדים, לוח זמנים של 90 יום ותוצאות מדידות לפני ואחרי.</p>
                <div className="text-primary text-sm group-hover:underline">לצפייה בסיפורי הלקוחות ←</div>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">מה נכלל בשיתוף הפעולה</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: GraduationCap, title: "הדרכת צוות", body: "סדנאות למלמדים ולמנהלים — כולל חומרי לימוד בעברית והקלטות." },
              { icon: ShieldCheck, title: "פרטיות ותאימות", body: "עמידה בדרישות משרד החינוך, PIN למכשירים משותפים ו-RLS מלא." },
              { icon: Users, title: "מנהל חשבון ייעודי", body: "איש קשר טכני ופדגוגי לאורך כל שנת הלימודים." },
              { icon: FileText, title: "מסמכי הטמעה", body: "תוכנית 30/60/90 יום, טפסי אישור הורים ותבניות תקשורת." },
              { icon: Sparkles, title: "AI מותאם למוסד", body: "פרופיל סגנון שלומד את שפת הרב והכיתה — עלונים ומבחנים בקול המוסד." },
              { icon: Handshake, title: "תמחור מוסדי", body: "הנחות היקף, מודל תשלום שנתי או רב-שנתי, וחשבוניות מרוכזות." },
            ].map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardHeader>
                  <Icon className="h-6 w-6 text-primary mb-1" />
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">{body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-card border rounded-2xl p-8 text-center max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">רוצים לבחון התאמה למוסד שלכם?</h2>
          <p className="text-muted-foreground mb-6">
            שלחו לנו פרטים ונשלח לכם ערכת הטמעה מלאה: מפרט טכני, סילבוס הדרכה, טופס אישור הורים לדוגמה,
            ותוכנית עבודה ל-90 ימים ראשונים.
          </p>
          <a href="mailto:partners@classalign.app?subject=בקשת%20ערכת%20הטמעה">
            <Button size="lg" className="gap-2"><Mail className="h-4 w-4" /> קבלת ערכת הטמעה</Button>
          </a>
        </section>

        <FaqSection items={FAQ} intro="התשובות הנפוצות ביותר שאנחנו מקבלים ממנהלי מוסדות, רבנים ומחנכים." />
      </main>
    </div>
  );
}

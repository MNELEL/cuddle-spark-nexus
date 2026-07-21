import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, School, GraduationCap, Handshake, FileText, ShieldCheck, Users, Sparkles, ArrowLeft, Download, Mail, Send } from "lucide-react";
import { FaqSection, faqJsonLd, type FaqItem } from "@/components/faq-section";
import { toast } from "sonner";

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
            <a href="mailto:nm0527603669@gmail.com?subject=בקשת%20שיתוף%20פעולה">
              <Button size="lg" className="gap-2"><Mail className="h-4 w-4" /> בקשת שיחת הכרות</Button>
            </a>
            <a href="/downloads/classalign-implementation-guide.pdf" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="gap-2"><Download className="h-4 w-4" /> מסמך הטמעה (PDF)</Button>
            </a>
            <a href="/downloads/classalign-implementation-guide.html" target="_blank" rel="noreferrer">
              <Button size="lg" variant="ghost" className="gap-2"><FileText className="h-4 w-4" /> גרסת HTML</Button>
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

        <PartnerContactForm />

        <FaqSection items={FAQ} intro="התשובות הנפוצות ביותר שאנחנו מקבלים ממנהלי מוסדות, רבנים ומחנכים." />
      </main>
    </div>
  );
}

function PartnerContactForm() {
  const [f, setF] = useState({
    institutionName: "",
    institutionType: "school",
    contactName: "",
    role: "",
    email: "",
    phone: "",
    studentCount: "",
    teacherCount: "",
    demoDate: "",
    message: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.institutionName || !f.contactName || !f.email) {
      toast.error("נא למלא שם מוסד, שם איש קשר ואימייל");
      return;
    }
    const typeLabel =
      f.institutionType === "district" ? "מחוז/רשת" :
      f.institutionType === "yeshiva" ? "ישיבה" :
      f.institutionType === "cheder" ? "חיידר / ת״ת" : "בית ספר";
    const body = [
      `בקשת דמו / שיתוף פעולה`,
      ``,
      `מוסד: ${f.institutionName}`,
      `סוג: ${typeLabel}`,
      `איש קשר: ${f.contactName}${f.role ? ` (${f.role})` : ""}`,
      `אימייל: ${f.email}`,
      `טלפון: ${f.phone || "-"}`,
      `מספר תלמידים: ${f.studentCount || "-"}`,
      `מספר מלמדים: ${f.teacherCount || "-"}`,
      `מועד מועדף לדמו: ${f.demoDate || "-"}`,
      ``,
      `הודעה:`,
      f.message || "-",
    ].join("\n");
    const href = `mailto:nm0527603669@gmail.com?subject=${encodeURIComponent(`בקשת דמו: ${f.institutionName}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    toast.success("נפתח לך חלון מייל — שלחו לסיום");
  };

  return (
    <section id="contact" className="max-w-3xl mx-auto">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-2xl">בקשת דמו למחוזות ובתי ספר</CardTitle>
          <p className="text-sm text-muted-foreground">
            מלאו פרטי מוסד ואיש קשר, ונחזור אליכם עם ערכת הטמעה מלאה ומועד לדמו חי.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>שם המוסד *</Label>
              <Input value={f.institutionName} onChange={(e) => set("institutionName", e.target.value)} placeholder="ת״ת / ישיבה / רשת" />
            </div>
            <div>
              <Label>סוג המוסד</Label>
              <Select value={f.institutionType} onValueChange={(v) => set("institutionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">בית ספר</SelectItem>
                  <SelectItem value="cheder">חיידר / תלמוד תורה</SelectItem>
                  <SelectItem value="yeshiva">ישיבה</SelectItem>
                  <SelectItem value="district">מחוז / רשת</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תפקיד</Label>
              <Input value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="מנהל / מזכיר / רכז" />
            </div>
            <div>
              <Label>שם איש הקשר *</Label>
              <Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </div>
            <div>
              <Label>אימייל *</Label>
              <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            </div>
            <div>
              <Label>מועד מועדף לדמו</Label>
              <Input type="date" value={f.demoDate} onChange={(e) => set("demoDate", e.target.value)} />
            </div>
            <div>
              <Label>מספר תלמידים</Label>
              <Input value={f.studentCount} onChange={(e) => set("studentCount", e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <Label>מספר מלמדים</Label>
              <Input value={f.teacherCount} onChange={(e) => set("teacherCount", e.target.value)} inputMode="numeric" />
            </div>
            <div className="sm:col-span-2">
              <Label>הודעה חופשית</Label>
              <Textarea rows={4} value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="ספרו לנו על צרכי המוסד — מה הכי חשוב שתראו בדמו?" />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
              <Button type="submit" size="lg" className="gap-2">
                <Send className="h-4 w-4" /> שליחת בקשה
              </Button>
              <a href="mailto:nm0527603669@gmail.com?subject=בקשת%20ערכת%20הטמעה">
                <Button type="button" size="lg" variant="outline" className="gap-2">
                  <Mail className="h-4 w-4" /> שליחת מייל ישיר
                </Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

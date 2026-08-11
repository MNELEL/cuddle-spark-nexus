import { socialImageMeta } from "@/lib/social-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  FileText,
  ScanLine,
  BookOpen,
  ListChecks,
  Printer,
  ShieldCheck,
  Gift,
} from "lucide-react";

const URL_SELF = "https://hakitasheli.lovable.app/tools/exam-generator";

const TITLE = "מחולל מבחנים AI · יצירת מבחן אוטומטי | הכיתה שלי";
const DESCRIPTION =
  "מחולל מבחנים חכם למלמדים ולמורים: הפקת מבחן מלא מתוך טקסט מקור, גמרא, חומש או תמונה של דף — כולל מפתח תשובות והדפסה. חודש ניסיון חינם.";

const FAQ: { q: string; a: string }[] = [
  {
    q: "מה זה מחולל מבחנים AI?",
    a: "כלי שמקבל את חומר הלימוד שלמדתם — טקסט שהדבקתם, סוגיה בגמרא, פרק בחומש או צילום של דף — ומייצר ממנו מבחן מלא: שאלות אמריקאיות, שאלות פתוחות, השלמות ונכון/לא נכון, יחד עם מפתח תשובות.",
  },
  {
    q: "אפשר לייצר מבחן מתוך תמונה של דף?",
    a: "כן. אפשר להעלות צילום או סריקה של דף גמרא, חוברת או סיכום, והמחולל יקרא את הטקסט ויבנה ממנו שאלות בעברית.",
  },
  {
    q: "האם זה מתאים גם למקצועות קודש וגם לחול?",
    a: "כן. יש תמיכה מלאה בגמרא, משנה, חומש, נביא, הלכה, מוסר ופרשת שבוע, וגם במקצועות חול כמו חשבון, לשון, מדעים ואנגלית.",
  },
  {
    q: "אפשר לערוך את המבחן שנוצר?",
    a: "בהחלט. כל שאלה ניתנת לעריכה, מחיקה או החלפה, ואפשר לקבוע רמת קושי, מספר שאלות וסוגי שאלות לפני ההפקה.",
  },
  {
    q: "מה העלות?",
    a: "רישום במייל פותח חודש ניסיון מלא בחינם, כולל מחולל המבחנים וכל הכלים הנוספים של הכיתה שלי.",
  },
];

export const Route = createFileRoute("/tools/exam-generator")({
  component: ExamGeneratorLanding,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "מחולל מבחנים AI למלמדים ולמורים" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
      { name: "twitter:title", content: "מחולל מבחנים AI · הכיתה שלי" },
      { name: "twitter:description", content: "בנו מבחן מלא מתוך טקסט או תמונה של דף — כולל מפתח תשובות והדפסה." },
      ...socialImageMeta(),
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "מחולל מבחנים AI",
          url: URL_SELF,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          inLanguage: "he",
          description: "יצירת מבחנים אוטומטית מתוך טקסט מקור או תמונה, למקצועות קודש וחול.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "חודש ניסיון חינם" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "בית", item: "https://hakitasheli.lovable.app/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "כלים חינמיים",
              item: "https://hakitasheli.lovable.app/blog/free-tools-comparison",
            },
            { "@type": "ListItem", position: 3, name: "מחולל מבחנים" },
          ],
        }),
      },
    ],
  }),
});

const FEATURES = [
  {
    icon: FileText,
    title: "מטקסט מקור למבחן מלא",
    body: "הדביקו סוגיה, פרק או סיכום שיעור — ותקבלו מבחן בנוי עם ניסוח בעברית תקנית והתאמה לגיל התלמידים.",
  },
  {
    icon: ScanLine,
    title: "סריקת דף או תמונה",
    body: "העלו צילום של דף גמרא, חוברת או מבחן קודם. המחולל קורא את הדף ובונה ממנו שאלות חדשות.",
  },
  {
    icon: BookOpen,
    title: "קודש וחול באותו כלי",
    body: "גמרא, משנה, חומש, נביא, הלכה ומוסר — לצד חשבון, לשון, מדעים ואנגלית, עם מינוח מותאם לתלמוד תורה.",
  },
  {
    icon: ListChecks,
    title: "שליטה על סוג ורמת השאלות",
    body: "בחרו מספר שאלות, רמת קושי ותמהיל: אמריקאיות, פתוחות, השלמות ונכון/לא נכון — וערכו כל שאלה.",
  },
  {
    icon: Printer,
    title: "הדפסה ומפתח תשובות",
    body: "פלט מוכן להדפסה בעברית RTL, כולל דף מפתח תשובות נפרד לבדיקה מהירה.",
  },
  {
    icon: ShieldCheck,
    title: "החומר שלכם נשאר שלכם",
    body: "המבחנים משויכים לכיתה שלכם בלבד ונשמרים בחשבון המוסד — בלי שיתוף עם מלמדים אחרים.",
  },
];

const STEPS = [
  { n: "1", t: "בוחרים כיתה ומקצוע", d: "המחולל מכיר את מקצועות הקודש והחול של הכיתה." },
  { n: "2", t: "מזינים את החומר", d: "הדבקת טקסט, בחירת מקור מהספרייה או העלאת תמונה של דף." },
  { n: "3", t: "מגדירים את המבחן", d: "מספר שאלות, רמת קושי וסוגי שאלות." },
  { n: "4", t: "מקבלים, עורכים ומדפיסים", d: "עריכה חופשית, שמירה לכיתה והדפסה עם מפתח תשובות." },
];

function ExamGeneratorLanding() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> חזרה לדף הבית
        </Link>
        <Link to="/login" search={{ next: "/classes" }}>
          <Button variant="outline" size="sm">התחברות</Button>
        </Link>
      </header>

      <main className="container mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs text-amber-foreground/80 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber" aria-hidden="true" /> חודש ניסיון חינם · רישום במייל
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            מחולל מבחנים <span className="text-gradient-amber">AI</span> למלמד ולמורה
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            במקום לבנות מבחן משעות של הקלדה — הדביקו את החומר שלמדתם או העלו צילום של הדף,
            וקבלו מבחן מוכן להדפסה עם מפתח תשובות. מותאם למקצועות קודש ולמקצועות חול.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" search={{ mode: "signup", next: "/classes" }}>
              <Button size="lg" className="gap-2 shadow-glow-primary">
                התחילו ניסיון חינם <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/tools/group-maker">
              <Button size="lg" variant="outline" className="gap-2">
                לכלים החינמיים ללא רישום
              </Button>
            </Link>
          </div>
        </div>

        <section className="mb-16">
          <h2 className="font-display text-2xl font-bold mb-6">מה המחולל יודע לעשות</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-card/60">
                <CardHeader className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle as="h3" className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-muted-foreground">{f.body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="font-display text-2xl font-bold mb-6">איך זה עובד — ארבעה שלבים</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-border/70 bg-card/60 p-5">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber/15 font-display font-bold text-amber">
                  {s.n}
                </div>
                <h3 className="font-bold text-sm">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-16 max-w-3xl">
          <h2 className="font-display text-2xl font-bold mb-4">שאלות נפוצות על יצירת מבחנים אוטומטית</h2>
          <div className="space-y-4 text-sm">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/60 p-8 text-center">
          <h2 className="font-display text-2xl font-bold">מוכנים לבנות את המבחן הראשון?</h2>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            רישום במייל פותח חודש ניסיון מלא — מחולל המבחנים, סורק המבחנים, דוחות פדגוגיים
            וכל ארגז הכלים של המלמד.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" search={{ mode: "signup", next: "/classes" }}>
              <Button size="lg" className="gap-2 shadow-glow-primary">
                <Gift className="h-4 w-4" aria-hidden="true" /> הרשמה · חודש ניסיון חינם
              </Button>
            </Link>
            <Link to="/blog">
              <Button size="lg" variant="outline">לבלוג המלמדים</Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

import { socialImageMeta } from "@/lib/social-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shuffle, FileQuestion, Sparkles, ClipboardList } from "lucide-react";
import { SITE_NAME, SITE_URL } from "@/lib/site-meta";

const URL_SELF = `${SITE_URL}/tools`;
const TITLE = "כלים חינמיים למלמד ולרב · הכיתה שלי";
const DESCRIPTION =
  "אוסף כלים חינמיים לניהול כיתה בתלמוד תורה ובחיידר: מחולל קבוצות אקראי, מחולל מבחנים AI וצ'קליסט ניהול כיתה להדפסה.";

export const Route = createFileRoute("/tools/")({
  component: ToolsIndex,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      ...socialImageMeta(),
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
  }),
});

const FREE_TOOLS = [
  {
    to: "/tools/group-maker" as const,
    icon: Shuffle,
    label: "מחולל קבוצות אקראי",
    desc: "חלוקת תלמידים לקבוצות שוות והגרלת תלמיד בודד — בלי הרשמה, הכל בדפדפן.",
    badge: "חינמי · ללא הרשמה",
  },
  {
    to: "/tools/exam-generator" as const,
    icon: FileQuestion,
    label: "מחולל מבחנים AI",
    desc: "בניית מבחן או בוחן לפי מקצוע, נושא ורמת קושי — עם מפתח תשובות מוכן להדפסה.",
    badge: "חינמי · ללא הרשמה",
  },
  {
    to: "/blog/classroom-management-strategies/checklist" as const,
    icon: ClipboardList,
    label: "צ'קליסט ניהול כיתה (PDF)",
    desc: "מסמך להדפסה עם חמש אסטרטגיות ומעקב שבועי — מופק עם שם המוסד שלכם.",
    badge: "הורדה חינמית",
  },
];

function ToolsIndex() {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> חזרה לדף הבית
        </Link>
        <Link to="/login">
          <Button variant="outline" size="sm">התחברות</Button>
        </Link>
      </header>

      <main className="container mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs text-amber-foreground/80 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber" /> כלים חינמיים למלמד
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            ארגז הכלים החינמי של <span className="text-gradient-amber">{SITE_NAME}</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            כלים מוכנים לשימוש מיידי בכיתה — בלי התקנה ובלי תשלום. שאר כלי המערכת (מעקב פדגוגי,
            סידור הושבה, דו״חות להורים) פתוחים בחודש ניסיון חינם לאחר רישום במייל.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {FREE_TOOLS.map((t) => (
            <Card key={t.to} className="flex flex-col">
              <CardHeader>
                <t.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <CardTitle as="h2" className="text-base mt-2">{t.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                  <div className="mt-3 text-xs text-amber-foreground/80">{t.badge}</div>
                </div>
                <Link to={t.to}>
                  <Button variant="outline" className="w-full gap-2">
                    פתיחת הכלי <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            רוצים את המערכת המלאה לניהול הכיתה? רישום במייל פותח חודש ניסיון בחינם.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="gap-2">
                רישום חינמי · חודש ניסיון <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/blog">
              <Button size="lg" variant="outline">מדריכים ומאמרים</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

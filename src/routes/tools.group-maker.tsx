import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shuffle, Users, UserRound, Copy, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const URL_SELF = "https://cuddle-spark-nexus.lovable.app/tools/group-maker";

export const Route = createFileRoute("/tools/group-maker")({
  component: GroupMakerPage,
  head: () => ({
    meta: [
      { title: "מחולל קבוצות אקראי · בחירת תלמיד רנדומלי | ClassAlign" },
      { name: "description", content: "כלי חינמי ומהיר לחלוקת תלמידים לקבוצות אקראיות ולהגרלת תלמיד בודד — מותאם לכיתות, חיידרים ותלמודי תורה. ללא הרשמה." },
      { property: "og:title", content: "מחולל קבוצות אקראי · בחירת תלמיד רנדומלי" },
      { property: "og:description", content: "חלקו כיתה לקבוצות שוות בקליק. הזנת שמות, בחירת מספר קבוצות, וקבלת חלוקה אקראית + בוחר שמות." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
      { name: "twitter:title", content: "מחולל קבוצות אקראי · ClassAlign" },
      { name: "twitter:description", content: "כלי חינמי לחלוקת תלמידים לקבוצות ולהגרלת שם — ללא הרשמה." },
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "מחולל קבוצות אקראי",
          url: URL_SELF,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          inLanguage: "he",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: "מחלק תלמידים לקבוצות אקראיות ובוחר תלמיד רנדומלי לכיתה.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "איך משתמשים במחולל הקבוצות?",
              acceptedAnswer: { "@type": "Answer", text: "הדביקו רשימת שמות (שם לכל שורה), בחרו כמה קבוצות אתם רוצים, ולחצו על 'חלק לקבוצות'. הכלי יגריל חלוקה אקראית שווה." },
            },
            {
              "@type": "Question",
              name: "האם השימוש בכלי חינמי?",
              acceptedAnswer: { "@type": "Answer", text: "כן. הכלי חינמי לחלוטין, לא דורש הרשמה, והנתונים נשארים במכשיר שלכם." },
            },
            {
              "@type": "Question",
              name: "האם הנתונים נשמרים?",
              acceptedAnswer: { "@type": "Answer", text: "לא. השמות שאתם מזינים לא נשלחים לשרת ולא נשמרים בשום מקום — הכל מתבצע בדפדפן." },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "בית", item: "https://cuddle-spark-nexus.lovable.app/" },
            { "@type": "ListItem", position: 2, name: "כלים", item: "https://cuddle-spark-nexus.lovable.app/tools/group-maker" },
            { "@type": "ListItem", position: 3, name: "מחולל קבוצות" },
          ],
        }),
      },
    ],
  }),
});

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function parseNames(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function GroupMakerPage() {
  const [raw, setRaw] = useState("");
  const [numGroups, setNumGroups] = useState(4);
  const [groups, setGroups] = useState<string[][]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  const names = useMemo(() => parseNames(raw), [raw]);

  const doGroups = () => {
    if (names.length < 2) return toast.error("הזינו לפחות שני שמות");
    const n = Math.max(2, Math.min(numGroups, names.length));
    const shuffled = shuffle(names);
    const out: string[][] = Array.from({ length: n }, () => []);
    shuffled.forEach((name, i) => out[i % n].push(name));
    setGroups(out);
    setPicked(null);
  };

  const doPick = () => {
    if (names.length < 1) return toast.error("הזינו שם אחד לפחות");
    setPicked(shuffle(names)[0]);
    setGroups([]);
  };

  const copyAll = async () => {
    if (!groups.length) return;
    const text = groups
      .map((g, i) => `קבוצה ${i + 1}:\n${g.map((n) => `• ${n}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח");
  };

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
            <Sparkles className="h-3.5 w-3.5 text-amber" /> כלי חינמי · ללא הרשמה
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            מחולל קבוצות אקראי <span className="text-gradient-amber">ובוחר שמות</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            הדביקו רשימת תלמידים, בחרו מספר קבוצות, וקבלו חלוקה אקראית שווה — או הגרילו תלמיד בודד למענה. הכל בדפדפן, בלי לשלוח נתונים.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">רשימת שמות</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="names">שם לכל שורה (או מופרד בפסיקים)</Label>
                <Textarea
                  id="names"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={"משה\nיוסי\nחיים\nאברהם\n..."}
                  className="mt-2 min-h-[220px] font-mono-tabular text-sm"
                />
                <div className="mt-2 text-xs text-muted-foreground">{names.length} שמות</div>
              </div>
              <div>
                <Label htmlFor="num">מספר קבוצות</Label>
                <Input
                  id="num"
                  type="number"
                  min={2}
                  max={Math.max(2, names.length || 2)}
                  value={numGroups}
                  onChange={(e) => setNumGroups(parseInt(e.target.value) || 2)}
                  className="mt-2 w-32"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={doGroups} className="gap-2">
                  <Shuffle className="h-4 w-4" /> חלק לקבוצות
                </Button>
                <Button onClick={doPick} variant="outline" className="gap-2">
                  <UserRound className="h-4 w-4" /> הגרל תלמיד
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">תוצאה</CardTitle>
              {groups.length > 0 && (
                <Button size="sm" variant="ghost" onClick={copyAll} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> העתק
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {picked && (
                <div className="rounded-xl border border-amber/40 bg-amber/10 p-8 text-center">
                  <UserRound className="mx-auto h-8 w-8 text-amber mb-3" />
                  <div className="text-xs text-muted-foreground mb-1">התלמיד שנבחר</div>
                  <div className="font-display text-3xl font-bold">{picked}</div>
                </div>
              )}
              {groups.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g, i) => (
                    <div key={i} className="rounded-lg border border-border/70 bg-card/60 p-4">
                      <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                        <Users className="h-4 w-4 text-primary" /> קבוצה {i + 1}
                        <span className="text-xs text-muted-foreground font-normal">({g.length})</span>
                      </div>
                      <ul className="space-y-1 text-sm">
                        {g.map((n) => <li key={n}>• {n}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {!picked && groups.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-12">
                  התוצאה תופיע כאן אחרי שתלחצו על אחד הכפתורים.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="mt-16 max-w-3xl mx-auto">
          <h2 className="font-display text-2xl font-bold mb-4">שאלות נפוצות</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-bold mb-1">איך משתמשים במחולל הקבוצות?</h3>
              <p className="text-muted-foreground">הדביקו רשימת שמות (שם לכל שורה), בחרו כמה קבוצות אתם רוצים, ולחצו על "חלק לקבוצות". הכלי יגריל חלוקה אקראית שווה.</p>
            </div>
            <div>
              <h3 className="font-bold mb-1">האם השימוש בכלי חינמי?</h3>
              <p className="text-muted-foreground">כן. הכלי חינמי לחלוטין, לא דורש הרשמה, והנתונים נשארים במכשיר שלכם.</p>
            </div>
            <div>
              <h3 className="font-bold mb-1">האם הנתונים נשמרים?</h3>
              <p className="text-muted-foreground">לא. השמות שאתם מזינים לא נשלחים לשרת ולא נשמרים בשום מקום — הכל מתבצע בדפדפן.</p>
            </div>
          </div>
        </section>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">מחפשים ניהול כיתה מלא עם AI?</p>
          <Link to="/">
            <Button size="lg" className="gap-2">
              גלו את ClassAlign Studio <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
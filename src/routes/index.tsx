import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Sparkles, Layout, Brain, BarChart3, Presentation, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ClassAlign Studio · ניהול כיתה חכם עם AI" },
      { name: "description", content: "סטודיו ניהול כיתה לרוח המודרנית — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה." },
    ],
  }),
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background" dir="rtl">
      {/* mesh background */}
      <div className="absolute inset-0 bg-mesh opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,var(--background)_75%)] pointer-events-none" />

      <header className="relative container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">ClassAlign <span className="text-gradient-amber">Studio</span></span>
        </div>
        <Link to="/login">
          <Button variant="outline" className="border-primary/20 backdrop-blur">התחברות</Button>
        </Link>
      </header>

      <main className="relative container mx-auto px-6 py-20 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/30 bg-amber/10 px-3 py-1 text-xs font-medium text-amber-foreground/80">
            <Sparkles className="h-3.5 w-3.5 text-amber" />
            סטודיו ניהול כיתה · גרסת AI מלאה
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            הכיתה שלך,<br />
            <span className="text-gradient-amber">מסונכרנת בשלמות.</span>
          </h1>
          <p className="mt-7 mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
            סידור הושבה אופטימלי בעזרת AI, מעקב פדגוגי חי, מצב מצגת תלת-ממדי ודוחות מקצועיים — בממשק עברית מלא וחווייתי.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="text-base shadow-glow-primary gap-2">
                להתחיל עכשיו <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base">גלה תכונות</Button>
            </a>
          </div>

          {/* preview card */}
          <div className="mt-16 mx-auto max-w-3xl">
            <div className="rounded-3xl border border-border/60 bg-card/70 p-2 shadow-glow-amber backdrop-blur-xl">
              <div className="rounded-2xl bg-gradient-to-br from-background to-secondary/40 p-8">
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const filled = i % 3 !== 0;
                    return (
                      <div
                        key={i}
                        className={`aspect-square rounded-lg border ${filled ? "border-amber/40 bg-amber/10" : "border-dashed border-border bg-muted/30"} flex items-center justify-center text-[10px] font-mono-tabular text-muted-foreground`}
                      >
                        {filled ? String(i + 1).padStart(2, "0") : ""}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 h-1 rounded-full bg-gradient-to-l from-amber via-amber-glow to-primary" />
                <div className="mt-3 flex justify-between text-xs text-muted-foreground font-mono-tabular">
                  <span>שולחן מורה</span>
                  <span>24 מושבים · 18 תפוסים</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section id="features" className="mx-auto mt-28 grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { icon: Brain, title: "AI Sort חכם", desc: "Gemini בוחן יחסים, ציונים והעדפות ומציע סידור מיטבי — עם הסבר לכל החלטה." },
            { icon: BarChart3, title: "ציון ביצועים", desc: "מטריקה חיה לכל תלמיד שמשקללת ציונים, נוכחות והתנהגות — מציגה מי דורש תשומת לב." },
            { icon: Presentation, title: "מצב מצגת 3D", desc: "תצוגה תלת-ממדית עוצרת נשימה עם 4 מצלמות, אנונימיזציה ומצב הצגה למפקחים." },
            { icon: Users, title: "CRM פדגוגי", desc: "תזכורות, נקודות התנהגות, ולוח מובילים — לשמר את הקצב הפדגוגי לאורך השנה." },
            { icon: Layout, title: "גריד חכם", desc: "גרירה חופשית, נעילת מושבים, חיבור שולחנות בזוגות, ושמירת תצורות מרובות." },
            { icon: Sparkles, title: "דוחות PDF", desc: "סיכום כיתתי או אישי בעיצוב A4 מקצועי, מוכן להדפסה או לשליחה להורים." },
          ].map((f) => (
            <div key={f.title} className="group relative rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur transition hover:border-amber/40 hover:shadow-glow-amber">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-amber group-hover:text-amber-foreground transition">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <footer className="mt-28 text-center text-xs text-muted-foreground">
          נבנה עם אהבה למורים · ClassAlign Studio © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

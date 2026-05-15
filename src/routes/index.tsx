import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Sparkles, Layout } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/40">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">ClassManager Pro</span>
        </div>
        <Link to="/login">
          <Button variant="outline">התחברות</Button>
        </Link>
      </header>

      <main className="container mx-auto px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            ניהול כיתה חכם.<br />
            <span className="text-primary">סידור הושבה מושלם.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            כלי מתקדם למורים: ניהול תלמידים, אילוצים פדגוגיים וחברתיים, וסידורי הושבה אופטימליים — הכל במקום אחד.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="text-base">להתחיל עכשיו</Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: "ניהול תלמידים", desc: "פרטים, גובה, העדפות שורה ופינה, הערות פדגוגיות לכל תלמיד." },
            { icon: Sparkles, title: "אילוצים חברתיים", desc: "חברים מועדפים, מניעת חיכוך, ריחוק מרחבי — הכול נלקח בחשבון." },
            { icon: Layout, title: "סידור הושבה", desc: "גריד גמיש, גרירה ושחרור, ונעילת מושבים — בקרוב." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

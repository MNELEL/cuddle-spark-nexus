import { SeatFillGrid } from "@/components/seat-fill-grid";
import { TorahLogo } from "@/components/torah-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Users, Sparkles, Layout, Brain, BarChart3, Presentation, ArrowLeft, BookOpen, Wrench, Mail, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/user-roles.functions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "הכיתה שלי · ניהול כיתה חכם לתלמודי תורה וחיידרים" },
      { name: "description", content: "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה." },
      { property: "og:title", content: "הכיתה שלי · ניהול כיתה חכם לתלמודי תורה וחיידרים" },
      { property: "og:description", content: "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/05baaa1b-2e2c-4979-b6f1-619d01883919" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/05baaa1b-2e2c-4979-b6f1-619d01883919" },
      { name: "twitter:title", content: "הכיתה שלי · ניהול כיתה חכם לתלמודי תורה וחיידרים" },
      { name: "twitter:description", content: "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה." },
    ],
    links: [{ rel: "canonical", href: "https://cuddle-spark-nexus.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "הכיתה שלי",
          url: "https://cuddle-spark-nexus.lovable.app/",
          inLanguage: "he",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "הכיתה שלי",
          url: "https://cuddle-spark-nexus.lovable.app/",
          description: "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "הכיתה שלי",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          inLanguage: "he",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: "ניהול כיתה הכולל סידור הושבה מבוסס AI, מעקב פדגוגי, גמיפיקציה, ספריית עזרי הוראה, ודוחות להורים.",
          featureList: [
            "סידור הושבה אופטימלי בעזרת AI",
            "מעקב ציונים והתנהגות",
            "מצב תצוגה תלת-ממדי",
            "דוחות PDF להורים",
            "ספריית חומרי הוראה",
          ],
        }),
      },
    ],
  }),
});

function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyRoles);
  const [mounted, setMounted] = useState(false);
  const [checkingRoles, setCheckingRoles] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setCheckingRoles(true);
    fetchRoles()
      .then((roles) => {
        if (cancelled) return;
        const roleList = roles.map((r) => r.role);
        // teacher / secretary go to /classes; admin / principal also go to /classes until a dedicated school dashboard exists.
        const destination = roleList.some((r) => ["admin", "principal", "teacher", "secretary"].includes(r)) ? "/classes" : "/classes";
        navigate({ to: destination, replace: true });
      })
      .catch(() => {
        if (!cancelled) navigate({ to: "/classes", replace: true });
      })
      .finally(() => {
        if (!cancelled) setCheckingRoles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, navigate, fetchRoles]);

  // While the session is being determined on the client, show a lightweight loading state
  // so authenticated users never see the marketing page flash.
  if (mounted && (authLoading || checkingRoles)) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען...</div>;
  }

  if (user) return null;
  return (
    <div className="relative min-h-screen overflow-hidden bg-background" dir="rtl">
      {/* mesh background */}
      <div className="absolute inset-0 bg-mesh opacity-90 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,var(--background)_75%)] pointer-events-none" />

      <header className="relative container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow-primary">
            <TorahLogo size={20} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">הכיתה <span className="text-gradient-amber">שלי</span></span>
        </div>
        <Link to="/login">
          <Button variant="outline" className="border-primary/20 backdrop-blur">התחברות</Button>
        </Link>
      </header>

      <main className="relative container mx-auto px-6 py-20 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/15 px-3 py-1 text-xs font-medium text-foreground sm:text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber" aria-hidden="true" />
            ניהול כיתה · מותאם לישיבות, חיידרים ותלמודי תורה
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            הכיתה שלך,<br />
            <span className="text-amber">מסונכרנת בשלמות.</span>
          </h1>
          <p className="mt-7 mx-auto max-w-2xl font-sans text-lg text-muted-foreground md:text-xl">
            שיבוץ, לוחות זמנים ויעדים, הושבה, מעקב פדגוגי ודוחות, חומרי לימוד, מבצעים ופגישות הורים — הכל במקום אחד.
          </p>
          <p className="mt-3 font-sans text-sm text-muted-foreground/80">
            נבנה עבור מלמדים ורבנים
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="text-base shadow-glow-primary gap-2">
                להתחיל עכשיו <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base">גלה תכונות</Button>
            </a>
          </div>
          <p className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground">
            <Gift className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            חודש ניסיון חינם · רישום במייל בלבד, ללא כרטיס אשראי
          </p>

          <div className="mt-14 mx-auto max-w-2xl" aria-hidden="true">
            <SeatFillGrid />
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
                  <span>שולחן הרב</span>
                  <span>24 מושבים · 18 תפוסים</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section id="features" className="mx-auto mt-28 max-w-6xl">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-3 text-amber/70" aria-hidden="true">
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber/50" />
              <TorahLogo size={18} />
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber/50" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">כלים לניהול החדר</h2>
            <p className="mt-3 text-sm text-muted-foreground">כל מה שהמלמד צריך — בסדר, בכתב ובזמן.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Brain, letter: "א", title: "סידור הושבה חכם", desc: "המערכת בוחנת יחסים בין תלמידים, ידיעות והעדפות ומציעה סידור מיטבי — עם הסבר לכל החלטה." },
            { icon: BarChart3, letter: "ב", title: "מדד התמדה", desc: "תמונת מצב חיה לכל תלמיד — ידיעות, נוכחות ומידות — כדי לדעת מי זקוק לתשומת לב." },
            { icon: Presentation, letter: "ג", title: "תצוגת חדר", desc: "תצוגה תלת-ממדית של סדר החדר, עם אנונימיזציה ומצב הצגה למפקחים ולהנהלה." },
            { icon: Users, letter: "ד", title: "מעקב פדגוגי", desc: "תזכורות, נקודות מידות טובות ולוח מבצעים — לשמר את הקצב הפדגוגי לאורך כל הזמן." },
            { icon: Layout, letter: "ה", title: "מפת מושבים", desc: "גרירה חופשית, נעילת מקומות, חיבור שולחנות בזוגות ושמירת תצורות לכל סדר." },
            { icon: Sparkles, letter: "ו", title: "דוחות ותעודות", desc: "סיכום כיתתי או אישי בעיצוב A4 מהודר, מוכן להדפסה או לשליחה להורים." },
          ].map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur transition hover:border-amber/50 hover:shadow-glow-amber"
            >
              {/* decorative top rule, like a page header line */}
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-amber/50 to-transparent opacity-60" aria-hidden="true" />
              {/* Hebrew ordinal letter watermark */}
              <span
                className="pointer-events-none absolute -top-3 left-4 select-none font-display text-6xl font-bold text-amber/10 transition group-hover:text-amber/20"
                aria-hidden="true"
              >
                {f.letter}׳
              </span>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-amber/30 bg-amber/10 text-amber transition group-hover:bg-amber group-hover:text-amber-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-5 font-display text-lg font-bold">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
          </div>
        </section>

        <footer className="mt-28 text-center text-xs text-muted-foreground">
          נבנה עם אהבה למלמדים ולרבנים · הכיתה שלי © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

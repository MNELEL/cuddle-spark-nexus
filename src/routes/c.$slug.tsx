import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicClassShowcase } from "@/lib/public-class.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Calendar, Users, BookOpen, Sparkles } from "lucide-react";

const BASE = "https://cuddle-spark-nexus.lovable.app";

const showcaseOpts = (slug: string) =>
  queryOptions({
    queryKey: ["public-showcase", slug],
    queryFn: () => getPublicClassShowcase({ data: { slug } }),
  });

export const Route = createFileRoute("/c/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(showcaseOpts(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const url = `${BASE}/c/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [{ title: "עמוד לא נמצא" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.className} · התקדמות לימודית · ClassAlign`;
    const desc =
      loaderData.description ??
      loaderData.headline ??
      `דף כיתה ציבורי — התקדמות לימודית, ממוצעים לפי מקצוע ועדכונים שבועיים מהרב.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: desc.slice(0, 200) },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: loaderData.className,
            description: desc,
            url,
            inLanguage: "he",
          }),
        },
      ],
    };
  },
  notFoundComponent: NotFound,
  errorComponent: NotFound,
  component: ShowcasePage,
});

function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen grid place-items-center bg-background p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">הדף אינו זמין</h1>
        <p className="mt-2 text-sm text-muted-foreground">ייתכן שהרב סגר את השיתוף הציבורי, או שהכתובת שגויה.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← לעמוד הבית של ClassAlign
        </Link>
      </div>
    </div>
  );
}

function ShowcasePage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPublicClassShowcase);
  const { data } = useSuspenseQuery({
    ...showcaseOpts(slug),
    queryFn: () => fn({ data: { slug } }),
  });
  if (!data) return <NotFound />;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold">ClassAlign Studio</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">בלוג</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
        <section>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber" /> דף כיתה ציבורי
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">
            {data.headline ?? data.className}
          </h1>
          {data.headline && <p className="mt-1 text-muted-foreground">{data.className}</p>}
          {data.description && (
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">{data.description}</p>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Users} label="תלמידים בכיתה" value={String(data.studentCount)} />
          <Stat icon={GraduationCap} label="ממוצע כללי" value={data.overallAvg != null ? `${data.overallAvg}%` : "—"} />
          <Stat icon={Calendar} label="שיעור נוכחות" value={data.attendanceRate != null ? `${data.attendanceRate}%` : "—"} />
        </section>

        {data.subjectAverages.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold">ממוצעים לפי מקצוע</h2>
            <p className="text-sm text-muted-foreground">
              נתונים מצטברים בלבד — ללא פרטי תלמידים. מוצגים מקצועות עם 3+ ציונים.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.subjectAverages.map((s) => (
                <Card key={s.subject}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <div className="font-medium">{s.subject}</div>
                      <div className="text-xs text-muted-foreground">{s.samples} ציונים</div>
                    </div>
                    <Badge className="bg-amber text-amber-foreground font-mono-tabular">{s.average}%</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.bulletins.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber" /> עלונים שבועיים
            </h2>
            <div className="space-y-3">
              {data.bulletins.map((b) => (
                <Card key={b.id}>
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{b.title}</h3>
                      <span className="text-xs text-muted-foreground font-mono-tabular">
                        {b.start_date} → {b.end_date}
                      </span>
                    </div>
                    {b.summary && <p className="text-sm whitespace-pre-wrap leading-relaxed">{b.summary}</p>}
                    {b.study_points.length > 0 && (
                      <ul className="list-disc ps-5 text-sm space-y-1">
                        {b.study_points.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <p className="text-sm text-muted-foreground">
            העמוד הזה נבנה עם ClassAlign Studio — מערכת ניהול כיתה, מעקב התקדמות ותקשורת
            עם הורים לתלמודי תורה ובתי ספר.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link to="/" className="text-base font-semibold text-primary hover:underline">
              גלה את ClassAlign ←
            </Link>
            <Link to="/parents-guide" className="text-base font-semibold text-primary hover:underline">
              משאבים להורים ←
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4 text-amber" /> {label}
        </div>
        <div className="mt-1 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
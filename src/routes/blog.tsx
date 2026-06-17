import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  const isLeaf = useRouterState({
    select: (s) => s.location.pathname !== "/blog" && s.location.pathname !== "/blog/",
  });
  if (isLeaf) return <Outlet />;
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה לדף הבית
          </Link>
          <span className="text-sm font-semibold">בלוג ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">מאמרים ומדריכים</h1>
        <p className="mt-3 text-muted-foreground">
          תוכן מקצועי לרבנים, מלמדים ומנהלי תלמודי תורה — בגובה העיניים.
        </p>
        <ul className="mt-10 space-y-6">
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/digital-hall-pass-guide" className="block">
              <h2 className="text-xl font-semibold">
                מדריך: ניהול אישורי יציאה דיגיטליים בתלמוד תורה
              </h2>
              <p className="mt-2 text-muted-foreground">
                איך מערכת מעקב דיגיטלית מחליפה את "הפתק" הישן, מצמצמת הפרעות לסדר השיעור,
                ושומרת על אחריות וביטחון בחיידר — חלופה ידידותית ל-eHallPass.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}

export default BlogLayout;
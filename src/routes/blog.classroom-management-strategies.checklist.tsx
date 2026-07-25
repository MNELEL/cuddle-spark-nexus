import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { submitChecklistLead } from "@/lib/checklist-leads.functions";
import { generateClassroomManagementChecklistPdf } from "@/lib/pdf/classroom-management-checklist-pdf";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/classroom-management-strategies/checklist";
const TITLE = "צ'קליסט ניהול כיתה בתלמוד תורה — PDF להורדה חינם";
const DESCRIPTION =
  "צ'קליסט מקצועי (PDF) עם 5 אסטרטגיות ניהול כיתה + מעקב שבועי למלמד. הרשמה קצרה ותוריד מיד עם מיתוג ClassAlign.";

export const Route = createFileRoute("/blog/classroom-management-strategies/checklist")({
  component: ChecklistPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

type Role = "rabbi" | "melamed" | "principal" | "other";
const ROLES: { value: Role; label: string }[] = [
  { value: "rabbi", label: "רב" },
  { value: "melamed", label: "מלמד" },
  { value: "principal", label: "מנהל" },
  { value: "other", label: "אחר" },
];

function ChecklistPage() {
  const submit = useServerFn(submitChecklistLead);
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<Role>("melamed");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await submit({
        data: {
          full_name: fullName.trim(),
          institution: institution.trim(),
          role,
          email: email.trim(),
          checklist_slug: "classroom-management-strategies",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
        },
      });
      await generateClassroomManagementChecklistPdf({
        schoolName: institution.trim() || "ClassAlign Studio",
        headerLine: `הופק עבור ${fullName.trim()} • צ'קליסט ניהול כיתה`,
      });
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "שגיאה. נסה שוב.");
      setStatus("error");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/blog/classroom-management-strategies" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה למדריך
          </Link>
          <span className="text-sm font-semibold">ClassAlign</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          צ'קליסט ניהול כיתה — PDF להורדה
        </h1>
        <p className="mt-4 text-muted-foreground">
          מסמך מקצועי אחד לכל מלמד: 5 אסטרטגיות ליישום מיידי, שגרות שבועיות, ומקום לרשום
          הערות. השאר פרטים קצרים והצ'קליסט יופק עם שם המוסד שלך על העמוד הראשון.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>✓ 6 מקטעים עם צ'קבוקסים להדפסה</li>
          <li>✓ מיתוג מוסדי — שם המוסד שלך על הכותרת</li>
          <li>✓ תמיכה מלאה בעברית ו-RTL, מוכן להדפסה</li>
        </ul>

        {status === "done" ? (
          <div className="mt-10 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <h2 className="text-xl font-semibold">הצ'קליסט יורד עכשיו 🎉</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              אם ההורדה לא התחילה, אפשר להוריד שוב:
            </p>
            <button
              type="button"
              onClick={() =>
                generateClassroomManagementChecklistPdf({
                  schoolName: institution.trim() || "ClassAlign Studio",
                  headerLine: `הופק עבור ${fullName.trim()} • צ'קליסט ניהול כיתה`,
                })
              }
              className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              הורד שוב את ה-PDF
            </button>
            <div className="mt-6 text-sm">
              <Link to="/" className="text-primary hover:underline">
                מוכן להטמיע את זה בכיתה? פתח כיתה ב-ClassAlign ←
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
            <div>
              <label className="block text-sm font-medium">שם מלא</label>
              <input
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="הרב ישראל ישראלי"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">שם המוסד</label>
              <input
                required
                maxLength={160}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="תלמוד תורה אור החיים"
              />
              <p className="mt-1 text-xs text-muted-foreground">יופיע ככותרת המוסד ב-PDF</p>
            </div>
            <div>
              <label className="block text-sm font-medium">תפקיד</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">אימייל</label>
              <input
                required
                type="email"
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="rabbi@example.com"
              />
            </div>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "מכין את ה-PDF..." : "הורד צ'קליסט (PDF)"}
            </button>
            <p className="text-xs text-muted-foreground">
              בהרשמה אתה מסכים שנשמור את הפרטים כדי לשלוח לפעמים עדכונים על ClassAlign. אפשר להסיר בכל עת.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
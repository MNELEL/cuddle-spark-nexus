import { Rss } from "lucide-react";
import { socialImageMeta } from "@/lib/social-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_INDEX_IMAGE, blogPostsNewestFirst } from "@/lib/blog-posts";
import { RSS_PATH } from "@/lib/blog-seo";
import { SITE_NAME, SITE_URL } from "@/lib/site-meta";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "בלוג הכיתה שלי · מאמרים ומדריכים לתלמודי תורה" },
      {
        name: "description",
        content:
          "מדריכים מקצועיים לרבנים, מלמדים ומנהלי תלמודי תורה — ניהול כיתה, מעקב פדגוגי, וכלים דיגיטליים בגובה העיניים.",
      },
      { property: "og:title", content: "בלוג הכיתה שלי · מאמרים ומדריכים לתלמודי תורה" },
      {
        property: "og:description",
        content:
          "מדריכים מקצועיים לרבנים, מלמדים ומנהלי תלמודי תורה — ניהול כיתה, מעקב פדגוגי וכלים דיגיטליים.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { property: "og:image", content: BLOG_INDEX_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: BLOG_INDEX_IMAGE },
      ...socialImageMeta("בלוג הכיתה שלי"),
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/blog` },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: `בלוג ${SITE_NAME} — RSS`,
        href: `${SITE_URL}${RSS_PATH}`,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `בלוג ${SITE_NAME}`,
          inLanguage: "he",
          url: `${SITE_URL}/blog`,
          blogPost: blogPostsNewestFirst().map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            url: `${SITE_URL}${post.path}`,
            image: [post.image],
            datePublished: post.published,
          })),
        }),
      },
    ],
  }),
});

function BlogIndex() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה לדף הבית
          </Link>
          <span className="text-sm font-semibold">בלוג הכיתה שלי</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">מאמרים ומדריכים</h1>
        <p className="mt-3 text-muted-foreground">
          תוכן מקצועי לרבנים, מלמדים ומנהלי תלמודי תורה — בגובה העיניים.
        </p>
        <a
          href={RSS_PATH}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-primary hover:bg-card/60"
        >
          <Rss className="h-4 w-4" aria-hidden="true" />
          הרשמה לעדכונים (RSS)
        </a>
        <ul className="mt-10 space-y-6">
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/classroom-management-strategies" className="block">
              <h2 className="text-xl font-semibold">אסטרטגיות ניהול כיתה — מדריך מקצועי</h2>
              <p className="mt-2 text-muted-foreground">
                חמש אסטרטגיות מוכחות לניהול כיתה בתלמוד תורה: תגבור התנהגות חיובית,
                עיצוב סביבה, שגרות, מעקב מבוסס נתונים ושותפות עם ההורים.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/progress-tracking-guide" className="block">
              <h2 className="text-xl font-semibold">מעקב התקדמות תלמידים — מדריך מלא</h2>
              <p className="mt-2 text-muted-foreground">
                איך לבנות מערכת מעקב שיטתית: יעדים, אינדיקטורים, דוחות שבועיים ושיחות
                הורים מבוססות נתונים.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/weekly-report-template" className="block">
              <h2 className="text-xl font-semibold">תבנית דו״ח שבועי לתלמיד</h2>
              <p className="mt-2 text-muted-foreground">
                תבנית מוכנה להעתקה עם דוגמה מלאה — לימודי קודש, מידות, מטרות שבועיות
                ופורמט להדפסה או שליחה בוואטסאפ.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">לתבנית ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/classroom-tools-teachers" className="block">
              <h2 className="text-xl font-semibold">10 כלי הוראה חינמיים שכל מלמד חייב</h2>
              <p className="mt-2 text-muted-foreground">
                רשימה מקצועית של כלים מודרניים לניהול כיתה — הגרלות, קבוצות, מבחנים
                אוטומטיים ומעקב התקדמות.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">לרשימה ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/digital-hall-pass-guide" className="block">
              <h2 className="text-xl font-semibold">ניהול אישורי יציאה דיגיטליים</h2>
              <p className="mt-2 text-muted-foreground">
                חלופה ידידותית ל-eHallPass — איך "הפתק" הישן מתחלף במערכת מסודרת
                בתלמוד תורה.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/classdojo-comparison" className="block">
              <h2 className="text-xl font-semibold">ClassDojo מול הכיתה שלי — השוואה לחיידר</h2>
              <p className="mt-2 text-muted-foreground">
                השוואה מלאה: עברית ו-RTL, מקצועות קודש, מונחי חיידר, פרטיות ודו״ח פדגוגי פרטי
                מול פיד חברתי ציבורי.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את ההשוואה ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/ai-seating-arrangements-guide" className="block">
              <h2 className="text-xl font-semibold">סידורי ישיבה חכמים עם AI — מדריך לכיתה גדולה</h2>
              <p className="mt-2 text-muted-foreground">
                איך להשתמש ב-AI Sort לבניית סידור ישיבה שמפחית הפרעות ומשפר ריכוז — במקום שעה של
                גרירת שמות על לוח.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">קרא את המדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/parasha-report-templates" className="block">
              <h2 className="text-xl font-semibold">תבניות דפי קשר ודו״ח שבועי לפרשת השבוע</h2>
              <p className="mt-2 text-muted-foreground">
                ספריית תבניות להדפסה לפי גילאים — מה לכלול בדף קשר, מבנה מומלץ לעמוד אחד,
                ואיך להפיק את הדו״ח אוטומטית כ-PDF.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">לתבניות ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/torah-study-reward-charts" className="block">
              <h2 className="text-xl font-semibold">לוח מבצעים ופרסים לתלמידים — מדריך ותבניות</h2>
              <p className="mt-2 text-muted-foreground">
                חמישה לוחות מבצעים להדפסה, שיטת ניקוד שעובדת וסולם פרסים לפי גיל — ואיך לחבר
                את לוח הקיר למעקב דיגיטלי.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">למדריך ←</span>
            </Link>
          </li>
          <li className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Link to="/blog/free-tools-comparison" className="block">
              <h2 className="text-xl font-semibold">השוואת כלי ניהול כיתה חינמיים</h2>
              <p className="mt-2 text-muted-foreground">
                פנקס, גיליון אקסל וכלים דיגיטליים ייעודיים — יתרונות, חסרונות והמלצה לכל שלב.
              </p>
              <span className="mt-3 inline-block text-sm text-primary">להשוואה ←</span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
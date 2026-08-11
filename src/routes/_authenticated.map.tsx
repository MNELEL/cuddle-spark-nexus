import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Map as MapIcon, Check, School } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HomeQuickNav } from "@/components/home-quick-nav";
import { listClasses } from "@/lib/classes.functions";
import { useToolAccess } from "@/hooks/use-tool-access";

type Item = {
  /** Route path; `$classId` is filled with the selected class. */
  to: string;
  label: string;
  sub?: string;
  /** Shown only to institution admins / principals. */
  adminOnly?: boolean;
};

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "ניהול הכיתה יום־יום",
    items: [
      { to: "/classes", label: "הכיתות שלי", sub: "רשימת תלמידים, נוכחות והתנהגות" },
      { to: "/weekly-schedule/$classId", label: "מערכת שעות ותורנויות", sub: "לוח שבועי מלא כולל לוח עברי וחגים" },
      { to: "/classes/$classId/display", label: "סידור הושבה ותצוגת כיתה", sub: "כולל תצוגה תלת־ממדית של הכיתה" },
      { to: "/daily/$classId", label: "סיכום יומי", sub: "מה קרה היום — להדפסה או לשליחה" },
      { to: "/bulletins/$classId", label: "עלון שבועי לכיתה", sub: "סיכום, חידה ופעילויות" },
      { to: "/calendar/$classId", label: "לוח אירועים", sub: "מבחנים, ימי הולדת ואירועי כיתה" },
    ],
  },
  {
    title: "הערכה, ציונים ומבחנים",
    items: [
      { to: "/exam-generator/$classId", label: "מחולל מבחנים", sub: "מבחן מותאם מהחומר שנלמד" },
      { to: "/exam-scanner/$classId", label: "סורק מבחנים", sub: "ניקוד מבחן סרוק בעזרת בינה מלאכותית" },
      { to: "/analytics/$classId", label: "אנליטיקת כיתה", sub: "מגמות ציונים והתפלגות, כולל שקלול" },
      { to: "/pedagogical/$classId", label: "דוח פדגוגי", sub: "תמונת מצב לכל תלמיד" },
      { to: "/reports/$classId", label: "דוחות מעקב", sub: "דוחות התקדמות להדפסה" },
      { to: "/certificates/$classId", label: "תעודות PDF", sub: "עם הלוגו והכותרת של המוסד, בעברית מלאה" },
      { to: "/insights", label: "תובנות", sub: "מגמות בציונים, נוכחות והתנהגות" },
    ],
  },
  {
    title: "מוטיבציה ופרסים",
    items: [
      { to: "/gamification/$classId", label: "מבצעים, נקודות וטבלת מובילים" },
      { to: "/raffle/$classId", label: "הגרלות בכיתה", sub: "גלגל מזל להגרלת תלמיד או פרס" },
      { to: "/poll/$classId", label: "סקר כיתה חי", sub: "שאלה לכיתה עם תוצאות בזמן אמת" },
    ],
  },
  {
    title: "קשר עם ההורים",
    items: [
      { to: "/parents/$classId", label: "מיילים ועדכונים להורים" },
      { to: "/share/$classId", label: "קישורי צפייה להורים" },
      { to: "/student-view/$classId", label: "מצב תלמיד", sub: "המסך כפי שהתלמיד וההורה רואים" },
    ],
  },
  {
    title: "חומרי הוראה וכלי שיעור",
    items: [
      { to: "/resources", label: "ספריית חומרי הוראה", sub: "מערכי שיעור, דפי עבודה ועזרים" },
      { to: "/resources/generate", label: "מחולל סיכומים ומשימות" },
      { to: "/questions", label: "מאגר שאלות", sub: "לפי מקצוע ונושא" },
      { to: "/toolkit", label: "ארגז כלים לשיעור", sub: "טיימר, בוחר אקראי, מדד רעש וכרטיסיות" },
      { to: "/bell-schedule", label: "לוח צלצולים ופעמונים" },
      { to: "/sound-board", label: "ניהול צלילים ואפקטים", sub: "כולל העלאת צליל משלך" },
    ],
  },
  {
    title: "תלמידים, ייבוא ומעבר שנה",
    items: [
      { to: "/ingest", label: "העלאה חכמה של רשימת תלמידים", sub: "זיהוי אוטומטי של שם פרטי ומשפחה, בלי למחוק מידע קיים" },
      { to: "/classes", label: "אשף מעבר שנה וארכיון כיתות", sub: "מתוך כרטיס הכיתה — כיתת המשך והעלאת תלמידים" },
      { to: "/classes/$classId", label: "תיק תלמיד ומידע רגיש", sub: "מידע רפואי ולימודי — גלוי למלמד ולמנהל בלבד" },
    ],
  },
  {
    title: "הגדרות ואבטחה",
    items: [
      { to: "/settings", label: "מרכז ההגדרות", sub: "קוד PIN, תזכורות ומצב המנוי" },
      { to: "/settings/brand", label: "מיתוג המוסד", sub: "לוגו, שם וכותרת בכל מסמך שמופק" },
      { to: "/settings/theme", label: "ערכת נושא", sub: "נשמרת ומופיעה בכל המכשירים" },
      { to: "/onboarding", label: "המדריך החכם", sub: "שישה שלבים מהקמת כיתה עד הדוח הראשון" },
      { to: "/institution", label: "לוח המוסד", sub: "כיתות, מלמדים וצוות", adminOnly: true },
      { to: "/user-management", label: "ניהול משתמשים והרשאות", adminOnly: true },
    ],
  },
];

export const Route = createFileRoute("/_authenticated/map")({
  component: SystemMapPage,
  head: () => ({
    meta: [
      { title: "מפת המערכת · הכיתה שלי" },
      { name: "description", content: "כל המסכים והכלים של הכיתה שלי במקום אחד — לחיצה אחת פותחת את המסך המתאים לכיתה שלך." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SystemMapPage() {
  const list = useServerFn(listClasses);
  const { access } = useToolAccess();
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => list() });
  const [picked, setPicked] = useState("");
  const activeClassId = picked || classes[0]?.id || "";
  const canSeeAdmin = Boolean(access?.isAdmin || access?.isPrincipal);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
          <MapIcon className="h-7 w-7 text-primary" aria-hidden="true" /> מפת המערכת
        </h1>
        <p className="text-sm text-muted-foreground">
          כל מה שיש במערכת, בעברית ובלחיצה אחת. בחר את הכיתה שלך — וכל פריט יפתח את המסך שלה.
        </p>
        <div className="mt-2"><HomeQuickNav /></div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle as="h2" className="flex items-center gap-2 text-sm">
            <School className="h-4 w-4 text-primary" aria-hidden="true" /> הכיתה שאליה הקישורים יובילו
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא הוגדרה כיתה.{" "}
              <Link to="/classes" className="text-primary underline">צור כיתה ראשונה</Link>{" "}
              וכל הקישורים כאן יתחילו לעבוד.
            </p>
          ) : (
            <Select value={activeClassId} onValueChange={setPicked}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {SECTIONS.map((section) => {
        const items = section.items.filter((it) => !it.adminOnly || canSeeAdmin);
        if (items.length === 0) return null;
        return (
          <Card key={section.title}>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="text-base">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {items.map((it) => (
                <MapRow key={`${section.title}-${it.to}-${it.label}`} item={it} classId={activeClassId} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-center text-xs text-muted-foreground">
        לא מצאת משהו? כל הכלים מרוכזים גם ב<Link to="/toolkit" className="text-primary underline">ארגז הכלים</Link>.
      </p>
    </div>
  );
}

function MapRow({ item, classId }: { item: Item; classId: string }) {
  const needsClass = item.to.includes("$classId");
  const disabled = needsClass && !classId;

  const body = (
    <>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
          disabled ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
        }`}
        aria-hidden="true"
      >
        <Check className="h-3 w-3" />
      </span>
      <span>
        <span className="font-medium">{item.label}</span>
        {item.sub && <span className="block text-xs text-muted-foreground">{item.sub}</span>}
        {disabled && <span className="block text-xs text-muted-foreground">נדרש ליצור כיתה כדי לפתוח מסך זה</span>}
      </span>
    </>
  );

  if (disabled) {
    return <div className="flex items-start gap-2 py-2.5 text-sm opacity-70">{body}</div>;
  }

  return (
    <Link
      to={item.to as never}
      params={(needsClass ? { classId } : {}) as never}
      className="flex items-start gap-2 rounded-md py-2.5 text-sm hover:bg-accent"
    >
      {body}
    </Link>
  );
}

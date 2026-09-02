import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { HebrewDatePanel } from "@/components/hebrew-date-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { HebrewWeeksCard } from "@/components/hebrew-weeks-card";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { elapsedSince, hebrewDayInfo, parseHebrewDateInput } from "@/lib/hebrew-calendar";

export const Route = createFileRoute("/_authenticated/hebrew-calendar")({
  component: HebrewCalendarPage,
  head: () => ({
    meta: [
      { title: "לוח תאריכים עברי · הכיתה שלי" },
      {
        name: "description",
        content:
          "לוח תאריכים עברי עצמאי: תאריך היום, תאריך-החלוף, שבועות החודש העברי והמרה בין תאריך עברי ולועזי.",
      },
      { property: "og:title", content: "לוח תאריכים עברי · הכיתה שלי" },
      {
        property: "og:description",
        content: "המרת תאריכים עבריים, חישוב ימים ושבועות שחלפו ותצוגת שבועות החודש העברי.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function HebrewCalendarPage() {
  const { date: anchor } = useHebrewAnchor();

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
          לוח תאריכים עברי
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          הזן תאריך עברי או לועזי, בדוק כמה ימים ושבועות חלפו בפועל וראה את שבועות החודש העברי.
          התאריך שנבחר כאן הוא המקור לכל תצוגות התאריך העברי באפליקציה ומתעדכן בכל המסכים מיד.
        </p>
      </div>

      <HebrewDatePanel editable />

      <ElapsedCalculator />

      <HebrewWeeksCard date={anchor} />
    </div>
  );
}

/** מחשבון תאריך-החלוף בין שני תאריכים עבריים או לועזיים. */
function ElapsedCalculator() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ text: string; error?: string } | null>(null);

  const resolve = (raw: string, fallback: Date): { date: Date } | { error: string } => {
    const t = raw.trim();
    if (!t) return { date: fallback };
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { date: new Date(`${t}T00:00:00`) };
    const parsed = parseHebrewDateInput(t);
    return parsed.ok ? { date: parsed.date } : { error: parsed.error };
  };

  const compute = () => {
    const a = resolve(from, new Date());
    const b = resolve(to, new Date());
    if ("error" in a) return setResult({ text: "", error: a.error });
    if ("error" in b) return setResult({ text: "", error: b.error });
    const span = elapsedSince(a.date, b.date);
    const ai = hebrewDayInfo(a.date);
    const bi = hebrewDayInfo(b.date);
    setResult({
      text:
        `מ־${ai.full} (${ai.iso}) עד ${bi.full} (${bi.iso}): ` +
        `${Math.abs(span.days)} ימים · ${span.weeks} שבועות ו-${span.restDays} ימים · ` +
        `${span.hebrewMonths} חודשים עבריים · ${span.label}`,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">תאריך-החלוף</CardTitle>
        <CardDescription>
          מחשב כמה ימים, שבועות וחודשים עבריים חלפו בין שני תאריכים. אפשר להזין תאריך עברי
          (כ״א אלול תשפ״ו) או לועזי (2026-09-02). שדה ריק = היום.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="elapsed-from">מתאריך</Label>
            <Input
              id="elapsed-from"
              value={from}
              placeholder="כ״א אלול תשפ״ו"
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="elapsed-to">עד תאריך</Label>
            <Input
              id="elapsed-to"
              value={to}
              placeholder="היום"
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button type="button" onClick={compute}>חשב</Button>
        </div>
        {result?.error && <p className="text-xs text-destructive">{result.error}</p>}
        {result?.text && <p className="text-sm font-medium">{result.text}</p>}
      </CardContent>
    </Card>
  );
}

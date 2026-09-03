import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HebrewDatePanel } from "@/components/hebrew-date-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HebrewWeeksCard } from "@/components/hebrew-weeks-card";
import { HebrewRangeLinksCard } from "@/components/hebrew-range-links-card";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import {
  elapsedSince,
  hebrewDayInfo,
  hebrewWeekBounds,
  isoOf,
  parseHebrewDateInput,
} from "@/lib/hebrew-calendar";
import { listClasses } from "@/lib/classes.functions";

export const Route = createFileRoute("/_authenticated/hebrew-calendar")({
  component: HebrewCalendarPage,
  head: () => ({
    meta: [
      { title: "לוח תאריכים עברי · הכיתה שלי" },
      {
        name: "description",
        content:
          "לוח תאריכים עברי אוטומטי: יום, שבוע וחודש עברי, תאריך-החלוף וטווחי סינון לדוחות ול-CRM.",
      },
      { property: "og:title", content: "לוח תאריכים עברי · הכיתה שלי" },
      {
        property: "og:description",
        content: "לוח עברי אוטומטי לפי הלוח האמיתי — יום, שבוע, חודש וסינון תאריכים למסכים.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function HebrewCalendarPage() {
  const { date: anchor, isCustom, info } = useHebrewAnchor();
  const list = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => list(),
  });
  const firstClassId = (classes as { id: string }[])[0]?.id;

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
          לוח תאריכים עברי
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          הלוח נגזר אוטומטית מהלוח העברי האמיתי ומתקדם מעצמו — יום, שבוע וחודש.
          {isCustom
            ? " כרגע נבחר תאריך ידני; הבחירה מתאפסת לבד ביום הבא."
            : " אין צורך להזין דבר: התאריך המוצג הוא היום העברי בפועל."}
        </p>
      </div>

      <Tabs defaultValue="day" dir="rtl">
        <TabsList>
          <TabsTrigger value="day">יום</TabsTrigger>
          <TabsTrigger value="week">שבוע</TabsTrigger>
          <TabsTrigger value="month">חודש</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="mt-4 space-y-4">
          <HebrewDatePanel editable />
          <ElapsedCalculator />
        </TabsContent>

        <TabsContent value="week" className="mt-4 space-y-4">
          <WeekDaysCard date={anchor} />
        </TabsContent>

        <TabsContent value="month" className="mt-4 space-y-4">
          <Card dir="rtl">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">חודש {info.month}</CardTitle>
              <CardDescription>
                טווח החודש העברי: {info.monthRange.from} – {info.monthRange.to}
              </CardDescription>
            </CardHeader>
          </Card>
          <HebrewWeeksCard date={anchor} />
        </TabsContent>
      </Tabs>

      <HebrewRangeLinksCard classId={firstClassId} />
    </div>
  );
}

/** שבעת ימי השבוע העברי הפעיל (ראשון–שבת) עם חגים, פרשה ותאריך-החלוף. */
function WeekDaysCard({ date }: { date: Date }) {
  const days = useMemo(() => {
    const { start } = hebrewWeekBounds(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return hebrewDayInfo(d);
    });
  }, [date]);
  const todayIso = isoOf(new Date());

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">
          שבוע {days[0]?.parasha ? `· ${days[0].parasha}` : ""}
        </CardTitle>
        <CardDescription>כל ימי השבוע העברי, כולל שישי ושבת, לפי הלוח האמיתי.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {days.map((d) => (
          <div
            key={d.iso}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 ${
              d.iso === todayIso ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={d.iso === todayIso ? "default" : "secondary"}>{d.weekday}</Badge>
              <span className="text-sm font-medium">{d.full}</span>
              {d.isRoshChodesh && (
                <Badge className="bg-accent text-accent-foreground">ראש חודש</Badge>
              )}
              {d.isShabbat && <Badge variant="outline">שבת</Badge>}
              {d.holidays.map((h) => (
                <Badge key={h} variant="outline">
                  {h}
                </Badge>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {d.iso} · {elapsedSince(d.iso).label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
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

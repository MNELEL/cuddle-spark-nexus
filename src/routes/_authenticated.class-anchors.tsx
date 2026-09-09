import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import {
  hebrewDayInfo,
  hebrewMonthBounds,
  isoOf,
  shiftHebrew,
} from "@/lib/hebrew-calendar";
import { getClassAnchorSummary } from "@/lib/class-anchor.functions";

export const Route = createFileRoute("/_authenticated/class-anchors")({
  component: ClassAnchorsPage,
  head: () => ({
    meta: [
      { title: "הכיתות שלי ותאריך-החלוף · הכיתה שלי" },
      {
        name: "description",
        content:
          "רשימת הכיתות שלי עם תאריך-החלוף, תאריך היום העברי, תאריך-החלוף הבא וסיכום התיעוד היומי לכל כיתה.",
      },
      { property: "og:title", content: "הכיתות שלי ותאריך-החלוף · הכיתה שלי" },
      {
        property: "og:description",
        content: "לוח עברי לכל הכיתות: תאריך-החלוף, היום, התאריך הבא וסיכום תיעוד יומי.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClassAnchorsPage() {
  const { date, elapsedFromInfo, info, elapsed, isElapsedCustom, resetElapsedFrom } = useHebrewAnchor();
  const qc = useQueryClient();
  const summary = useServerFn(getClassAnchorSummary);
  const iso = isoOf(date);

  /** תאריך-החלוף הבא: ראש החודש העברי הבא — נגזר מהלוח האמיתי ומתקדם לבד. */
  const nextAnchor = useMemo(
    () => hebrewDayInfo(hebrewMonthBounds(shiftHebrew(date, "month", 1)).start),
    [date],
  );

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["class-anchor-summary", iso],
    queryFn: () => summary({ data: { date: iso } }),
  });

  const refresh = () => {
    void refetch();
    void qc.invalidateQueries({ queryKey: ["daily-briefing"] });
    void qc.invalidateQueries({ queryKey: ["daily-log-report"] });
  };

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CalendarClock className="h-6 w-6 text-primary" aria-hidden="true" />
          הכיתות שלי ותאריך-החלוף
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          התאריכים נגזרים מהלוח העברי האמיתי ומתעדכנים לבד. לכל כיתה מוצג גם סיכום התיעוד של אותו יום.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">התאריכים הפעילים</CardTitle>
          <CardDescription>
            {isElapsedCustom
              ? "תאריך-החלוף הוזן ידנית — אפשר לחזור ללוח האוטומטי."
              : "תאריך-החלוף נגזר אוטומטית מתחילת שנת הלימודים העברית."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <AnchorBox title="תאריך-החלוף" value={elapsedFromInfo.full} sub={elapsedFromInfo.iso} />
            <AnchorBox title="תאריך היום" value={info.full} sub={info.iso} />
            <AnchorBox title="תאריך-החלוף הבא" value={nextAnchor.full} sub={nextAnchor.iso} />
          </div>
          <p className="text-sm">
            חלפו מאז תאריך-החלוף: <span className="font-medium">{elapsed.label}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={refresh} disabled={isFetching}>
              <RefreshCw className={`ms-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> עדכן
            </Button>
            {isElapsedCustom && (
              <Button type="button" variant="outline" onClick={resetElapsedFrom}>
                חזור ללוח האוטומטי
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/hebrew-calendar">לוח התאריכים העברי</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">סיכום תיעוד יומי לפי כיתה</CardTitle>
          <CardDescription>לפי התאריך הפעיל ({info.full}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין כיתות להצגה.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  {r.status === "archived" && <Badge variant="outline">בארכיון</Badge>}
                  <Badge variant="secondary">{r.students} תלמידים</Badge>
                  <Badge variant="outline">נוכחות {r.attendance}</Badge>
                  <Badge variant="outline">ציונים {r.grades}</Badge>
                  <Badge variant="outline">תובנות {r.insights}</Badge>
                  <Badge variant="outline">אישורים {r.approvals}</Badge>
                  {r.notes && <Badge className="bg-accent text-accent-foreground">הערת מלמד</Badge>}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/daily-report/$classId" params={{ classId: r.id }}>
                    דוח תיעוד יומי
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnchorBox({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      <p className="font-mono text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

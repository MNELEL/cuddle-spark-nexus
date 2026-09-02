import { CalendarCheck, ArrowLeftRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { elapsedSince } from "@/lib/hebrew-calendar";

/**
 * תיעוד יומי אוטומטי — כרטיס שנוצר מחדש בכל יום מתוך הלוח העברי הפעיל:
 * תאריך היום, פרשת השבוע, מועדים, מספר השבוע ותאריך-החלוף מול התאריך הנבחר.
 */
export function DailyLogCard({ className }: { className?: string }) {
  const { info, isCustom, now } = useHebrewAnchor();
  const elapsed = elapsedSince(info.iso, now);

  const rows: { label: string; value: string }[] = [
    { label: "תאריך עברי", value: info.full },
    { label: "יום בשבוע", value: info.weekday },
    { label: "שבוע בחודש", value: `שבוע ${info.weekOfMonth} · ${info.month}` },
    { label: "שבוע בשנה", value: `שבוע ${info.weekOfYear}` },
    { label: "תאריך-החלוף", value: elapsed.label },
    { label: "תאריך לועזי", value: info.iso },
  ];

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <CalendarCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          תיעוד יומי
          {isCustom && <Badge variant="outline">לפי תאריך נבחר</Badge>}
          {info.parasha && <Badge variant="secondary">{info.parasha}</Badge>}
          {info.isRoshChodesh && <Badge className="bg-accent text-accent-foreground">ראש חודש</Badge>}
        </CardTitle>
        <CardDescription>
          נרשם אוטומטית בכל יום מתוך הלוח העברי — ללא הזנה ידנית.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-2 border-b border-dashed py-1"
            >
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="text-sm font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
        {info.holidays.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {info.holidays.map((h) => (
              <Badge key={h} variant="outline">{h}</Badge>
            ))}
          </p>
        )}
        <Link
          to="/hebrew-calendar"
          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          שינוי התאריך הפעיל בלוח העברי
        </Link>
      </CardContent>
    </Card>
  );
}

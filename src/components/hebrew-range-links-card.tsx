import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hebrewRangePresets } from "@/lib/hebrew-calendar";
import { useHebrewAnchor } from "@/components/hebrew-anchor";

/**
 * טווחי תאריכים אוטומטיים מהלוח העברי (יום, שבוע, חודש, שנה) לשימוש
 * במסכים כמו דוחות ו-CRM, עם קישור ישיר למסכים האלה.
 */
export function HebrewRangeLinksCard({
  classId,
  className,
}: {
  classId?: string;
  className?: string;
}) {
  const { date } = useHebrewAnchor();
  const presets = useMemo(() => hebrewRangePresets(date), [date]);

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">סינון תאריכים למסכים</CardTitle>
        <CardDescription>
          הטווחים נגזרים אוטומטית מהלוח העברי הפעיל, ואותם טווחים זמינים בדוחות וב-CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {presets.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5"
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{p.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {p.from} – {p.to}
              </span>
            </div>
            {classId && (
              <div className="flex gap-1.5">
                <Button asChild size="sm" variant="outline" className="h-auto py-1 text-xs">
                  <Link to="/reports/$classId" params={{ classId }}>
                    דוחות
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-auto py-1 text-xs">
                  <Link to="/classes/$classId" params={{ classId }}>
                    CRM
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

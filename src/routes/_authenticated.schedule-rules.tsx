import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { listClasses } from "@/lib/classes.functions";
import { RecurringRulesPanel } from "@/components/schedule/recurring-rules-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/schedule-rules")({
  component: ScheduleRulesPage,
  head: () => ({
    meta: [
      { title: "כללים קבועים במערכת · הכיתה שלי" },
      { name: "description", content: "ניהול כללים חוזרים במערכת השעות — סיום מוקדם ביום קבוע וראש חודש, לפי כיתה." },
      { property: "og:title", content: "כללים קבועים במערכת · הכיתה שלי" },
      { property: "og:description", content: "עריכה והשבתה של כללים חוזרים — יום שבועי קבוע וראש חודש — לכל כיתה." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ScheduleRulesPage() {
  const load = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => load() });
  const [classId, setClassId] = useState<string>("");
  const active = classId || classes[0]?.id || "";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarClock className="h-6 w-6 text-amber" aria-hidden="true" /> כללים קבועים במערכת השעות
        </h1>
        <p className="text-sm text-muted-foreground">
          כללים חוזרים — יום שבועי קבוע וראש חודש — מוגדרים פעם אחת ונאכפים לנצח. אפשר לערוך, להשבית או למחוק כל כלל.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">בחירת כיתה</CardTitle>
          <CardDescription>הכללים נשמרים לכל כיתה בנפרד.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm space-y-1.5">
          <Label>כיתה</Label>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">עדיין אין כיתות במערכת.</p>
          ) : (
            <Select value={active} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {active && <RecurringRulesPanel classId={active} />}
    </div>
  );
}
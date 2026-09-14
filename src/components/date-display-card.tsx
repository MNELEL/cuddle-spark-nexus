/**
 * העדפת תצוגת תאריכים: העברי הוא תמיד הראשי, הלועזי נוסף רק לפי בקשה.
 */
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { hebrewDateWithWeekday } from "@/lib/hebrew-date";
import { useShowGregorian, setShowGregorian } from "@/lib/date-display";

export function DateDisplayCard() {
  const showGreg = useShowGregorian();
  const today = new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-5 w-5" /> תצוגת תאריכים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="show-greg" className="cursor-pointer">הצג גם תאריך לועזי</Label>
            <p className="text-xs text-muted-foreground">
              כל המערכת מוצגת בתאריך עברי. הפעלה תוסיף את התאריך הלועזי בסוגריים ובשדות התאריך.
            </p>
          </div>
          <Switch id="show-greg" checked={showGreg} onCheckedChange={setShowGregorian} />
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          היום: {hebrewDateWithWeekday(today)}
          {showGreg ? ` (${today.toLocaleDateString("he-IL")})` : ""}
        </div>
      </CardContent>
    </Card>
  );
}

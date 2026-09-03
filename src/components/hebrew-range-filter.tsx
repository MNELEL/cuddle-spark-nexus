import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { hebrewRangePresets } from "@/lib/hebrew-calendar";
import { toHebrewDateFull } from "@/lib/hebrew-date";
import { useHebrewAnchor } from "@/components/hebrew-anchor";

export type DateRange = { from: string; to: string };

/**
 * סינון תאריכים לפי הלוח העברי — היום, השבוע (פרשה), חודש עברי נוכחי/קודם
 * ושנה עברית. כל הטווחים נגזרים בזמן אמת מהתאריך העברי הפעיל,
 * כך שכשהלוח מתקדם הטווחים מתעדכנים לבד.
 */
export function HebrewRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const { date } = useHebrewAnchor();
  const presets = useMemo(() => hebrewRangePresets(date), [date]);


  return (
    <div className={className} dir="rtl">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = value.from === p.from && value.to === p.to;
          return (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-auto py-1 text-xs"
              aria-pressed={active}
              onClick={() => onChange({ from: p.from, to: p.to })}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      {value.from && value.to && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          מוצג: {toHebrewDateFull(value.from) ?? value.from} – {toHebrewDateFull(value.to) ?? value.to}
        </p>
      )}
    </div>
  );
}

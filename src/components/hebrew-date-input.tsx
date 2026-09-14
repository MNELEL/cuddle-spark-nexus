/**
 * Hebrew-first date field.
 *
 * The Hebrew date is the primary, always-visible value. Free-text Hebrew entry
 * ("כ״א אלול תשפ״ו") and day stepping work without ever showing a Gregorian
 * date; the Gregorian picker appears only when the user asks for it (globally
 * via the "לועזי" preference, or per-field with the small toggle).
 */
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { hebrewDate } from "@/lib/hebrew-date";
import { parseHebrewDateInput, isoOf, shiftHebrew } from "@/lib/hebrew-calendar";
import { useShowGregorian } from "@/lib/date-display";
import { cn } from "@/lib/utils";

type Props = {
  /** ISO date, "YYYY-MM-DD". */
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Hide the ±day stepper (e.g. inside dense forms). */
  compact?: boolean;
};

function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** "כ״א אֱלוּל תשפ״ו" -> "כ״א אלול תשפ״ו" (nikud breaks month-name parsing). */
function plainHebrew(value: string): string {
  return value.replace(/[\u0591-\u05C7]/g, "");
}


export function HebrewDateInput({
  value,
  onChange,
  label,
  id,
  className,
  disabled,
  compact,
}: Props) {
  const globalGreg = useShowGregorian();
  const [showGreg, setShowGreg] = useState(globalGreg);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const fieldId = id ?? "hebrew-date-input";

  useEffect(() => setShowGreg(globalGreg), [globalGreg]);
  // Keep the free-text box in sync with the selected date.
  useEffect(() => {
    setText(plainHebrew(hebrewDate(value)));
    setError("");
  }, [value]);

  const current = parseIso(value);

  const commitText = () => {
    const parsed = parseHebrewDateInput(text);
    if (!parsed.ok) {
      setError(parsed.error || "תאריך עברי לא מזוהה");
      return;
    }
    setError("");
    onChange(isoOf(parsed.date));
  };

  const step = (amount: number) => {
    if (!current) return;
    onChange(isoOf(shiftHebrew(current, "day", amount)));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <div className="flex items-center gap-1.5">
        {!compact && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="יום קודם"
            disabled={disabled || !current}
            onClick={() => step(-1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <Input
          id={fieldId}
          value={text}
          disabled={disabled}
          placeholder="למשל: כ״א אלול תשפ״ו"
          className="text-center"
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            }
          }}
        />
        {!compact && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            aria-label="יום הבא"
            disabled={disabled || !current}
            onClick={() => step(1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl"
          aria-label={showGreg ? "הסתר תאריך לועזי" : "הצג תאריך לועזי"}
          aria-pressed={showGreg}
          disabled={disabled}
          onClick={() => setShowGreg((v) => !v)}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {showGreg && (
        <Input
          type="date"
          aria-label="תאריך לועזי"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

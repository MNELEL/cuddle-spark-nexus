import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/**
 * הסבר אחד לכל המערכת למה "חיבור לכיתה" חשוב — עם קישורים ישירים
 * למערכת השבועית ולעלון להורים של אותה כיתה.
 */
export function LibraryLinkExplanation({ classId }: { classId?: string }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      שיוך חומר מהספרייה לכיתה אומר שהחומר נקשר לשיעור או לעלון, ולכן הוא נפתח בלחיצה אחת מתוך{" "}
      {classId ? (
        <Link
          to="/weekly-schedule/$classId"
          params={{ classId }}
          className="font-semibold text-primary underline underline-offset-2"
        >
          המערכת השבועית
        </Link>
      ) : (
        <span className="font-semibold">המערכת השבועית</span>
      )}{" "}
      וגם מצורף אל{" "}
      {classId ? (
        <Link
          to="/bulletins/$classId"
          params={{ classId }}
          className="font-semibold text-primary underline underline-offset-2"
        >
          העלון להורים
        </Link>
      ) : (
        <span className="font-semibold">העלון להורים</span>
      )}{" "}
      (דף הקשר). בלי שיוך, החומר נשאר בספרייה בלבד ואף אחד לא רואה אותו מתוך השיעור או מתוך הדף שנשלח הביתה.
    </p>
  );
}

/** אינפו-בול קטן ליד הכותרת — נגיש גם בלחיצה במובייל. */
export function LibraryLinkInfo({ classId }: { classId?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full text-muted-foreground"
          aria-label="מה זה חיבור לכיתה?"
          title="מה זה חיבור לכיתה?"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-right" dir="rtl">
        <p className="mb-1 text-sm font-semibold">מה זה חיבור לכיתה?</p>
        <LibraryLinkExplanation classId={classId} />
      </PopoverContent>
    </Popover>
  );
}

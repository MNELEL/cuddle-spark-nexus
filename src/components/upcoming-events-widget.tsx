import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listUpcomingEvents, listMyActiveClasses, upsertClassEvent,
  type ClassEventType,
} from "@/lib/class-events.functions";
import { toHebrewDateFull, toIsoDate } from "@/lib/hebrew-date";

const TYPE_LABELS: Record<ClassEventType, string> = {
  birthday: "יום הולדת",
  exam: "בחינה",
  special_exam: "בחינה מיוחדת",
  trip: "טיול",
  holiday: "חג",
  meeting: "אסיפה",
  celebration: "שמחה",
  other: "אחר",
};

function daysUntil(iso: string): number {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function untilLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d <= 0) return "היום";
  if (d === 1) return "מחר";
  return `בעוד ${d} ימים`;
}

/**
 * פעמון "אירועים קרובים" — מוצג בכל רחבי האפליקציה, מציג את אירועי הלוח
 * מכל הכיתות ל-14 הימים הקרובים עם התאריך העברי, ומאפשר הוספת אירוע מהירה.
 */
export function UpcomingEventsWidget() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fetchEvents = useServerFn(listUpcomingEvents);
  const fetchClasses = useServerFn(listMyActiveClasses);
  const saveEvent = useServerFn(upsertClassEvent);

  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: () => fetchEvents({ data: { days: 14 } }),
    staleTime: 60_000,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["my-active-classes"],
    queryFn: () => fetchClasses(),
    enabled: open,
  });

  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ClassEventType>("other");
  const [date, setDate] = useState(toIsoDate(new Date()));

  const soonCount = useMemo(
    () => events.filter((e) => daysUntil(e.date) <= 3).length,
    [events],
  );

  const addMut = useMutation({
    mutationFn: () =>
      saveEvent({ data: { classId: classId || classes[0]?.id || "", title: title.trim(), type, date } }),
    onSuccess: () => {
      toast.success("האירוע נוסף ללוח");
      setTitle("");
      // כל מסך שמציג אירועים מתעדכן מיד — לוח הכיתה, התובנות והפעמון.
      void qc.invalidateQueries({ queryKey: ["upcoming-events"] });
      void qc.invalidateQueries({ queryKey: ["class-events"] });
      void qc.invalidateQueries({ queryKey: ["daily-briefing"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "הוספת האירוע נכשלה"),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            events.length > 0 ? `אירועים קרובים — ${events.length} אירועים` : "אירועים קרובים"
          }
        >
          <CalendarClock className="h-5 w-5" aria-hidden />
          {events.length > 0 && (
            <span
              className={`absolute -end-0.5 -top-0.5 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4 ${
                soonCount > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {events.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent dir="rtl" side="left" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">אירועים קרובים</SheetTitle>
          <SheetDescription>אירועי הלוח מכל הכיתות ב-14 הימים הקרובים, לפי התאריך העברי.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {events.length === 0 ? (
            <p className="rounded-md bg-muted/50 py-6 text-center text-sm text-muted-foreground">
              אין אירועים קרובים
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    <Badge variant="outline">{TYPE_LABELS[e.type] ?? e.type}</Badge>
                    {e.class_name && <Badge variant="secondary">{e.class_name}</Badge>}
                    <Badge className={daysUntil(e.date) <= 3 ? "bg-destructive text-destructive-foreground" : ""}>
                      {untilLabel(e.date)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toHebrewDateFull(e.date) ?? e.date} · {e.date}
                  </p>
                  {e.notes && <p className="mt-1 text-sm text-muted-foreground">{e.notes}</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-semibold">הוספת אירוע מהירה</p>
            <div className="space-y-1.5">
              <Label htmlFor="ue-title">כותרת</Label>
              <Input id="ue-title" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="לדוגמה: מבחן בגמרא" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="ue-date">תאריך</Label>
                <Input id="ue-date" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
                <p className="text-[11px] text-muted-foreground">{toHebrewDateFull(date) ?? ""}</p>
              </div>
              <div className="space-y-1.5">
                <Label>סוג</Label>
                <Select value={type} onValueChange={(v) => setType(v as ClassEventType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as ClassEventType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>כיתה</Label>
              <Select value={classId || classes[0]?.id || ""} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => addMut.mutate()}
              disabled={addMut.isPending || !title.trim() || !(classId || classes[0]?.id)}
            >
              <Plus className="ms-1 h-4 w-4" aria-hidden /> הוסף ללוח
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

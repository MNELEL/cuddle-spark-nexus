import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getScheduleSettings, listCalendarOverrides, listWeekNotes,
  type CalendarOverride, type ScheduleSettings, type WeekNote,
} from "@/lib/schedule-planning.functions";
import { addDays, holidaysInRange, isoDate, weekStartOf } from "@/lib/parasha";
import { dayKeyOf, expandOverrides } from "@/components/schedule/schedule-context";
import { listRecurringRules } from "@/lib/recurring-rules.functions";
import { effectiveRulesFor, type DayRuleEffect, type RecurringRule } from "@/lib/recurring-rules";

/** School year bounds (Aug 1 → Jul 31) unless the class configured its own. */
function defaultYearBounds(today = new Date()) {
  const startYear = today.getMonth() + 1 >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return { start: new Date(startYear, 7, 1), end: new Date(startYear + 1, 6, 31) };
}

export function useScheduleYear(classId: string) {
  const settingsFn = useServerFn(getScheduleSettings);
  const overridesFn = useServerFn(listCalendarOverrides);
  const notesFn = useServerFn(listWeekNotes);
  const rulesFn = useServerFn(listRecurringRules);

  const { data: settings } = useQuery({
    queryKey: ["schedule-settings", classId],
    queryFn: () => settingsFn({ data: { classId } }),
  });
  const { data: overrides = [] } = useQuery({
    queryKey: ["calendar-overrides", classId],
    queryFn: () => overridesFn({ data: { classId } }),
  });
  const { data: weekNotes = [] } = useQuery({
    queryKey: ["week-notes", classId],
    queryFn: () => notesFn({ data: { classId } }),
  });
  const { data: recurringRules = [] } = useQuery({
    queryKey: ["recurring-rules", classId],
    queryFn: () => rulesFn({ data: { classId } }),
  });

  const bounds = useMemo(() => {
    const def = defaultYearBounds();
    const s = settings as ScheduleSettings | undefined;
    return {
      start: s?.year_start_date ? new Date(`${s.year_start_date}T00:00:00`) : def.start,
      end: s?.year_end_date ? new Date(`${s.year_end_date}T00:00:00`) : def.end,
    };
  }, [settings]);

  const holidays = useMemo(
    () => holidaysInRange(isoDate(bounds.start), isoDate(bounds.end)),
    [bounds.start, bounds.end],
  );

  const holidayByDate = useMemo(() => {
    const m = new Map<string, { title: string; noSchool: boolean }>();
    for (const h of holidays) m.set(h.date, { title: h.title, noSchool: h.noSchool });
    return m;
  }, [holidays]);

  const overrideByDate = useMemo(
    () => expandOverrides(overrides as CalendarOverride[]),
    [overrides],
  );

  const activeDays = useMemo(
    () => new Set((settings as ScheduleSettings | undefined)?.active_days ?? ["sun", "mon", "tue", "wed", "thu", "fri"]),
    [settings],
  );

  const rules = useMemo(() => (recurringRules as RecurringRule[]).filter((r) => r.active), [recurringRules]);

  /** Merged effect of every recurring rule that matches this date. */
  const rulesForDate = (iso: string): DayRuleEffect => effectiveRulesFor(rules, iso);

  /** Is this a normal teaching day for the class? */
  const isTeachingDate = (iso: string): boolean => {
    const d = new Date(`${iso}T00:00:00`);
    const ovr = overrideByDate.get(iso) ?? [];
    if (ovr.some((o) => o.type === "extra_session")) return true;
    if (!activeDays.has(dayKeyOf(d))) return false;
    if (ovr.some((o) => o.type === "institution_break" || o.type === "unexpected_closure" || o.type === "holiday")) return false;
    if (holidayByDate.get(iso)?.noSchool) return false;
    if (effectiveRulesFor(rules, iso).noSchool) return false;
    return true;
  };

  const teachingDates = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(bounds.start); d <= bounds.end; d = addDays(d, 1)) {
      const iso = isoDate(d);
      if (isTeachingDate(iso)) out.push(iso);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start, bounds.end, overrideByDate, holidayByDate, activeDays, rules]);

  const weekStarts = useMemo(() => {
    const out: string[] = [];
    for (let d = weekStartOf(bounds.start); d <= bounds.end; d = addDays(d, 7)) out.push(isoDate(d));
    return out;
  }, [bounds.start, bounds.end]);

  const noteByWeek = useMemo(() => {
    const m = new Map<string, WeekNote>();
    for (const n of weekNotes as WeekNote[]) m.set(n.week_start, n);
    return m;
  }, [weekNotes]);

  return {
    settings: settings as ScheduleSettings | undefined,
    overrides: overrides as CalendarOverride[],
    holidays,
    holidayByDate,
    overrideByDate,
    activeDays,
    rules: recurringRules as RecurringRule[],
    rulesForDate,
    isTeachingDate,
    teachingDates,
    weekStarts,
    noteByWeek,
    bounds,
  };
}

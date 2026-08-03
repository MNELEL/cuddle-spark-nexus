// supabase/functions/recalculate-pacing/index.ts
//
// Deploy this as a Lovable Cloud / Supabase edge function.
// Called from the frontend as:
//   supabase.functions.invoke('recalculate-pacing', { body: { classId } })
//
// This version computes the school year boundaries and the fixed religious
// break ranges directly from the Hebrew calendar (via Hebcal's converter
// API), rather than requiring the caller to pass a year-end date:
//
//   - Year starts:  ראש חודש אלול (1 Elul)
//   - Year ends:    ז' באב (7 Av), or the Thursday before if 7 Av falls on Shabbat
//   - Institution breaks (auto-computed, NOT stored in academic_calendar_overrides —
//     they're passed straight into the RPC as part of the non-teaching-day set,
//     same as Hebcal holidays):
//       - ג'–כ"ג תשרי (3–23 Tishrei) inclusive
//       - Purim: 14–15 Adar (Adar II in a leap year)
//       - Chanukah: 3 days, 25–27 Kislev
//       - Pesach: from the Shabbat/week before 15 Nisan through 22 Nisan + 1 day
//         (implemented as 8 Nisan through 23 Nisan inclusive — one week before
//         the first day of Pesach through the day after the last day)
//
// Any of these can still be overridden/extended via academic_calendar_overrides
// (e.g. if a real bein-hazmanim differs from this default).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEBCAL_CONVERTER = "https://www.hebcal.com/converter";
const HEBCAL_EVENTS = "https://www.hebcal.com/hebcal";

interface RequestBody {
  classId: string;
}

// Convert a specific Hebrew date to Gregorian (YYYY-MM-DD) for a given Hebrew year.
async function hebrewToGregorian(hy: number, hm: string, hd: number): Promise<string> {
  const url = `${HEBCAL_CONVERTER}?cfg=json&hy=${hy}&hm=${encodeURIComponent(hm)}&hd=${hd}&h2g=1&strict=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hebcal converter failed for ${hy} ${hm} ${hd}: ${res.status}`);
  const data = await res.json();
  const gy = String(data.gy).padStart(4, "0");
  const gm = String(data.gm).padStart(2, "0");
  const gd = String(data.gd).padStart(2, "0");
  return `${gy}-${gm}-${gd}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(dateStr: string): number {
  // 0 = Sunday ... 6 = Saturday
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

// Determine the current/relevant Hebrew year for "today", anchored to the
// school year (which starts at Elul of the Gregorian year we're in, using
// Aug 1 as a rough Gregorian-side anchor consistent with the rest of the system).
function currentHebrewSchoolYear(): number {
  // Convert today's Gregorian date to a Hebrew year via the g2h converter,
  // then adjust: if today's Hebrew month is before Elul, we're still in the
  // school year that started the PREVIOUS Elul.
  // Simplification: since Elul->Av always spans one Hebrew year (X Elul .. X+1 Av... actually
  // Elul is the last month, so Av of year X+1 is the end of the SAME school year that started
  // Elul of year X). We resolve this precisely below using the g2h call.
  return 0; // placeholder, replaced by resolveSchoolYearHebrewNumbers()
}

async function gregorianToHebrewYear(dateStr: string): Promise<{ hy: number; hm: string }> {
  const [gy, gm, gd] = dateStr.split("-").map(Number);
  const url = `https://www.hebcal.com/converter?cfg=json&gy=${gy}&gm=${gm}&gd=${gd}&g2h=1&strict=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hebcal g2h failed: ${res.status}`);
  const data = await res.json();
  return { hy: data.hy, hm: data.hm };
}

// Elul is the 12th (or 13th in a leap year) month, always the LAST month of
// the Hebrew year. So "1 Elul of Hebrew year Y" starts the school year that
// ends "7 Av of Hebrew year Y+1".
async function resolveSchoolYearHebrewNumbers(): Promise<{ startHy: number; endHy: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { hy, hm } = await gregorianToHebrewYear(today);

  // If we're currently in Elul or later in that Hebrew year's cycle
  // (Tishrei is month 1, so months run Tishrei..Elul within a single hy),
  // figure out whether "today" falls before or after 1 Elul of hy.
  const elulStart = await hebrewToGregorian(hy, "Elul", 1);
  let startHy: number;
  if (today >= elulStart) {
    startHy = hy;
  } else {
    startHy = hy - 1;
  }
  return { startHy, endHy: startHy + 1 };
}

async function computeSchoolYearBounds() {
  const { startHy, endHy } = await resolveSchoolYearHebrewNumbers();

  const yearStart = await hebrewToGregorian(startHy, "Elul", 1);

  let yearEnd = await hebrewToGregorian(endHy, "Av", 7);
  if (dayOfWeek(yearEnd) === 6) {
    // 7 Av falls on Shabbat -> end on the Thursday before
    yearEnd = addDays(yearEnd, -2);
  }

  return { yearStart, yearEnd, startHy, endHy };
}

async function computeInstitutionBreaks(startHy: number, endHy: number): Promise<Array<{ start: string; end: string; label: string }>> {
  const breaks: Array<{ start: string; end: string; label: string }> = [];

  // Tishrei break: 3–23 Tishrei, falls in endHy (Tishrei is the 1st month of
  // the NEW Hebrew year that begins partway through the school year... actually
  // Tishrei 1 (Rosh Hashana) starts Hebrew year endHy, a few weeks after the
  // school year's Elul start in startHy).
  const tishreiStart = await hebrewToGregorian(endHy, "Tishrei", 3);
  const tishreiEnd = await hebrewToGregorian(endHy, "Tishrei", 23);
  breaks.push({ start: tishreiStart, end: tishreiEnd, label: "חופשת תשרי (ג׳–כ״ג בתשרי)" });

  // Purim: 2 days, 14–15 Adar. In a leap year Purim falls in Adar II ("Adar2" per Hebcal).
  // Determine leap year by checking if "Adar2" resolves successfully for endHy.
  let purimMonth = "Adar";
  try {
    await hebrewToGregorian(endHy, "Adar2", 14);
    purimMonth = "Adar2";
  } catch {
    purimMonth = "Adar";
  }
  const purimStart = await hebrewToGregorian(endHy, purimMonth, 14);
  const purimEnd = await hebrewToGregorian(endHy, purimMonth, 15);
  breaks.push({ start: purimStart, end: purimEnd, label: "חופשת פורים" });

  // Chanukah: 3 days, 25–27 Kislev (falls in startHy, since Kislev precedes Tishrei's
  // following Adar/Nisan within the same civil-ish stretch — Kislev is month 3,
  // occurring in the same Hebrew year as Tishrei, i.e. endHy).
  const chanukahStart = await hebrewToGregorian(endHy, "Kislev", 25);
  const chanukahEnd = await hebrewToGregorian(endHy, "Kislev", 27);
  breaks.push({ start: chanukahStart, end: chanukahEnd, label: "חופשת חנוכה" });

  // Pesach: from a week before 15 Nisan through the day after 22 Nisan
  const pesachFirstDay = await hebrewToGregorian(endHy, "Nisan", 15);
  const pesachLastDay = await hebrewToGregorian(endHy, "Nisan", 22);
  const pesachBreakStart = addDays(pesachFirstDay, -7);
  const pesachBreakEnd = addDays(pesachLastDay, 1);
  breaks.push({ start: pesachBreakStart, end: pesachBreakEnd, label: "חופשת פסח (משבוע לפני עד יום אחרי)" });

  return breaks;
}

async function fetchHebcalHolidayDates(start: string, end: string): Promise<string[]> {
  const startYear = new Date(start).getFullYear();
  const endYear = new Date(end).getFullYear();
  const dates = new Set<string>();

  for (let year = startYear; year <= endYear; year++) {
    const url = `${HEBCAL_EVENTS}?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=${year}&month=x&ss=on&mf=on&c=on&geonameid=281184`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Hebcal events fetch failed for year ${year}: ${res.status}`);
      continue;
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      if (!item.date) continue;
      const d = item.date.slice(0, 10);
      if (d >= start && d <= end) dates.add(d);
    }
  }
  return Array.from(dates);
}

function expandRangeToDates(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const { classId }: RequestBody = await req.json();
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { yearStart, yearEnd, startHy, endHy } = await computeSchoolYearBounds();
    const institutionBreaks = await computeInstitutionBreaks(startHy, endHy);
    const holidayDates = await fetchHebcalHolidayDates(yearStart, yearEnd);

    // fold the fixed institution breaks into the same non-teaching-day set
    // passed to the RPC (in addition to whatever the teacher has entered
    // manually in academic_calendar_overrides for that year)
    for (const b of institutionBreaks) {
      for (const d of expandRangeToDates(b.start, b.end)) {
        holidayDates.push(d);
      }
    }
    const uniqueDates = Array.from(new Set(holidayDates));

    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRoleCall = authHeader === `Bearer ${serviceRoleKey}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // The RPC is no longer executable by anon/authenticated, so it always runs
    // through the service-role client. When the call comes from a signed-in
    // user we must therefore verify class ownership here, under that user's
    // own RLS context, before escalating.
    if (!isServiceRoleCall) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const { data: owned, error: ownErr } = await userClient
        .from("classes")
        .select("id")
        .eq("id", classId)
        .maybeSingle();
      if (ownErr || !owned) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc("recalculate_pacing", {
      p_class_id: classId,
      p_holiday_dates: uniqueDates,
      p_year_end_date: yearEnd,
    });

    if (error) {
      console.error("recalculate_pacing RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ result: data, yearStart, yearEnd, institutionBreaks }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("recalculate-pacing edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

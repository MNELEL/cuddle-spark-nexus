import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, Filter, EyeOff, Eye, Gauge } from "lucide-react";
import type { RosterStudentDraft } from "@/lib/ingest.functions";

/* ------- target fields ------- */

export const FIELD_KEYS = [
  "name", "national_id", "birth_date", "address",
  "father_name", "father_id", "father_phone",
  "mother_name", "mother_id", "mother_phone",
] as const;
export type FieldKey = typeof FIELD_KEYS[number];

const FIELD_LABEL: Record<FieldKey, string> = {
  name: "שם התלמיד",
  national_id: "ת.ז. תלמיד",
  birth_date: "תאריך לידה",
  address: "כתובת",
  father_name: "שם אב",
  father_id: "ת.ז. אב",
  father_phone: "טלפון אב",
  mother_name: "שם אם",
  mother_id: "ת.ז. אם",
  mother_phone: "טלפון אם",
};

const FIELD_GROUP: Record<FieldKey, "student" | "ids" | "address" | "father" | "mother"> = {
  name: "student", national_id: "ids", birth_date: "student", address: "address",
  father_name: "father", father_id: "ids", father_phone: "father",
  mother_name: "mother", mother_id: "ids", mother_phone: "mother",
};
const GROUP_COLOR: Record<string, string> = {
  student: "bg-primary/10 text-primary",
  ids: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  address: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  father: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  mother: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
};

/* ------- validators ------- */

function validate(key: FieldKey, v: string): { ok: true } | { ok: false; msg: string } {
  const val = (v ?? "").trim();
  if (key === "name") {
    if (!val) return { ok: false, msg: "שם התלמיד חובה" };
    if (val.length < 2) return { ok: false, msg: "שם קצר מדי" };
    return { ok: true };
  }
  if (!val) return { ok: true }; // optional
  if (key === "national_id" || key === "father_id" || key === "mother_id") {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 5 || digits.length > 9) return { ok: false, msg: "ת.ז. חייבת להיות 5-9 ספרות" };
    return { ok: true };
  }
  if (key === "father_phone" || key === "mother_phone") {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 10) return { ok: false, msg: "טלפון לא תקין (9-10 ספרות)" };
    if (!/^0/.test(digits)) return { ok: false, msg: "טלפון מתחיל ב-0" };
    return { ok: true };
  }
  if (key === "birth_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return { ok: false, msg: "פורמט: YYYY-MM-DD" };
    const d = new Date(val);
    if (isNaN(d.getTime())) return { ok: false, msg: "תאריך לא תקין" };
    const y = d.getFullYear();
    if (y < 1990 || y > new Date().getFullYear()) return { ok: false, msg: "שנה מחוץ לטווח סביר" };
    return { ok: true };
  }
  return { ok: true };
}

/* ------- row type ------- */

type Row = RosterStudentDraft & { include: boolean };

export function RosterReviewTable({
  initialRows,
  onChange,
}: {
  initialRows: RosterStudentDraft[];
  onChange: (rows: Row[], errorCount: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialRows.map((r) => ({ ...r, include: r.include !== false })),
  );
  const [columns, setColumns] = useState<FieldKey[]>([...FIELD_KEYS]);
  const [filter, setFilter] = useState<"all" | "errors" | "missing">("all");
  const [threshold, setThreshold] = useState<number>(50);

  function commit(next: Row[]) {
    setRows(next);
    const errs = countRowErrors(next);
    onChange(next, errs);
  }

  function updateCell(rowIdx: number, key: FieldKey, val: string) {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: val } : r));
    commit(next);
  }
  function toggleInclude(rowIdx: number, include: boolean) {
    commit(rows.map((r, i) => (i === rowIdx ? { ...r, include } : r)));
  }
  function excludeAllWithErrors() {
    commit(rows.map((r) => (rowHasError(r) ? { ...r, include: false } : r)));
  }
  function includeAll() { commit(rows.map((r) => ({ ...r, include: true }))); }
  function excludeBelowThreshold() {
    const min = threshold / 100;
    commit(rows.map((r) => ((r.confidence ?? 1) < min ? { ...r, include: false } : r)));
  }

  /** swap the field at column position `colIdx` with `newKey` — moves values with it */
  function remapColumn(colIdx: number, newKey: FieldKey) {
    const oldKey = columns[colIdx];
    if (oldKey === newKey) return;
    const swapWithIdx = columns.indexOf(newKey);
    // swap headers
    const nextCols = [...columns];
    if (swapWithIdx >= 0) {
      nextCols[colIdx] = newKey;
      nextCols[swapWithIdx] = oldKey;
    } else {
      nextCols[colIdx] = newKey;
    }
    // swap the underlying data between oldKey and newKey per row
    const nextRows = rows.map((r) => {
      const a = (r[oldKey] as string | undefined) ?? "";
      const b = (r[newKey] as string | undefined) ?? "";
      return { ...r, [oldKey]: b, [newKey]: a } as Row;
    });
    setColumns(nextCols);
    commit(nextRows);
  }

  const visibleRows = useMemo(() => {
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (filter === "all") return true;
        if (filter === "errors") return rowHasError(r);
        if (filter === "missing") return rowHasMissing(r);
        return true;
      });
  }, [rows, filter]);

  const stats = useMemo(() => {
    const included = rows.filter((r) => r.include).length;
    const withErrors = rows.filter(rowHasError).length;
    const withMissing = rows.filter(rowHasMissing).length;
    const withConf = rows.filter((r) => typeof r.confidence === "number");
    const avg = withConf.length
      ? Math.round((withConf.reduce((s, r) => s + (r.confidence ?? 0), 0) / withConf.length) * 100)
      : 0;
    return { total: rows.length, included, withErrors, withMissing, avgConf: avg };
  }, [rows]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* header controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 text-xs">
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השורות ({stats.total})</SelectItem>
                <SelectItem value="errors">עם שגיאות ({stats.withErrors})</SelectItem>
                <SelectItem value="missing">עם שדות חסרים ({stats.withMissing})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />{stats.included} נבחרו</Badge>
          <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3 text-destructive" />{stats.withErrors} שגיאות</Badge>
          {stats.avgConf > 0 && (
            <Badge variant="secondary" className="gap-1"><Gauge className="h-3 w-3" />ביטחון ממוצע {stats.avgConf}%</Badge>
          )}
          <div className="ms-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={includeAll}>
              <Eye className="ms-1 h-3 w-3" />כלול הכל
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={excludeAllWithErrors}
              disabled={stats.withErrors === 0}>
              <EyeOff className="ms-1 h-3 w-3" />החרג שורות עם שגיאות
            </Button>
            <div className="flex items-center gap-1 rounded-md border px-2 h-7">
              <Gauge className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">סף</span>
              <input
                type="range" min={0} max={100} step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-1 w-20 accent-primary"
                aria-label="סף ביטחון"
              />
              <span className="text-[11px] tabular-nums w-8 text-end">{threshold}%</span>
              <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" onClick={excludeBelowThreshold}>
                החרג מתחת לסף
              </Button>
            </div>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-center w-8">✓</th>
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2 text-center w-24">ביטחון</th>
                {columns.map((col, colIdx) => (
                  <th key={colIdx} className="p-1 min-w-[130px] text-start">
                    <Select value={col} onValueChange={(v) => remapColumn(colIdx, v as FieldKey)}>
                      <SelectTrigger className={`h-7 text-[11px] ${GROUP_COLOR[FIELD_GROUP[col]]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_KEYS.map((k) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {FIELD_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </th>
                ))}
                <th className="p-2 text-center w-24">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={columns.length + 4} className="p-6 text-center text-muted-foreground">אין שורות להצגה בסינון הנוכחי</td></tr>
              ) : visibleRows.map(({ r, i }) => {
                const rowErr = rowErrors(r);
                const hasErr = rowErr.size > 0;
                const missing = rowMissingCount(r);
                const confPct = Math.round(((r.confidence ?? 1)) * 100);
                const confColor = confPct >= 80 ? "bg-emerald-500" : confPct >= 50 ? "bg-amber-500" : "bg-destructive";
                return (
                  <tr key={i} className={`border-b transition ${r.include ? "" : "opacity-40 bg-muted/20"}`}>
                    <td className="p-1 text-center">
                      <input type="checkbox" checked={r.include}
                        onChange={(e) => toggleInclude(i, e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary" />
                    </td>
                    <td className="p-1 text-center text-muted-foreground">{i + 1}</td>
                    <td className="p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5" aria-label={`ביטחון ${confPct}%`}>
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden min-w-[40px]">
                              <div className={`h-full ${confColor}`} style={{ width: `${confPct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-end">{confPct}%</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          מדד איכות השיבוץ (מבוסס על שלמות ופורמט השדות)
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    {columns.map((col) => {
                      const val = (r[col] as string | undefined) ?? "";
                      const err = rowErr.get(col);
                      return (
                        <td key={col} className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                value={val}
                                onChange={(e) => updateCell(i, col, e.target.value)}
                                className={`h-7 text-xs ${err ? "border-destructive bg-destructive/5 focus-visible:ring-destructive" : ""}`}
                                placeholder={FIELD_LABEL[col]}
                              />
                            </TooltipTrigger>
                            {err && (
                              <TooltipContent side="top" className="text-xs">
                                <span className="text-destructive">{err}</span>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className="p-1 text-center">
                      {hasErr ? (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" />{rowErr.size} שגיאות
                        </Badge>
                      ) : missing > 0 ? (
                        <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/60 text-amber-700 dark:text-amber-400">
                          {missing} חסרים
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/60 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />תקין
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          לחיצה על כותרת עמודה מאפשרת להתאים אותה לשדה יעד אחר. הערכים בעמודה יוחלפו בהתאם. שדות חובה: שם התלמיד. אדום = שגיאת ולידציה, כתום = שדה אופציונלי חסר.
        </p>
      </div>
    </TooltipProvider>
  );
}

/* ------- row-level helpers ------- */

function rowErrors(r: RosterStudentDraft): Map<FieldKey, string> {
  const m = new Map<FieldKey, string>();
  for (const k of FIELD_KEYS) {
    const v = (r[k] as string | undefined) ?? "";
    const res = validate(k, v);
    if (!res.ok) m.set(k, res.msg);
  }
  return m;
}
function rowHasError(r: RosterStudentDraft): boolean { return rowErrors(r).size > 0; }
function rowMissingCount(r: RosterStudentDraft): number {
  return FIELD_KEYS.filter((k) => k !== "name" && !((r[k] as string | undefined) ?? "").trim()).length;
}
function rowHasMissing(r: RosterStudentDraft): boolean { return rowMissingCount(r) > 0; }

function countRowErrors(rows: Row[]): number {
  return rows.filter((r) => r.include && rowHasError(r)).length;
}
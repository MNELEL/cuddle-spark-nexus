import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import type { StudentSnapshot } from "@/lib/ai-assistant.functions";

const STATUS_LABELS: Record<string, string> = {
  present: "נוכח", absent: "נעדר", late: "איחור", excused: "מאושר",
};

type Filter = "all" | "present" | "absent" | "late" | "excused" | "unmarked" | "low_grades";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "present", label: "נוכחים" },
  { key: "absent", label: "נעדרים" },
  { key: "late", label: "איחורים" },
  { key: "unmarked", label: "ללא רישום" },
  { key: "low_grades", label: "ציון מתחת ל-70" },
];

/** טבלת נתוני תלמידים בתוך תשובת קריאה — חיפוש וסינון בלי לצאת מהפאנל. */
export function AssistantSnapshotTable({ rows }: { rows: StudentSnapshot[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const needle = q.trim();
    return rows.filter((r) => {
      if (needle && !r.name.includes(needle)) return false;
      if (filter === "all") return true;
      if (filter === "unmarked") return r.todayStatus === null;
      if (filter === "low_grades") return r.gradeAvg !== null && r.gradeAvg < 70;
      return r.todayStatus === filter;
    });
  }, [rows, q, filter]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-card/60 p-2">
      <div className="relative">
        <Search className="absolute end-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש תלמיד…"
          className="h-9 pe-8 text-sm"
          aria-label="חיפוש תלמיד בתוך התשובה"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="h-auto py-0.5 text-[11px]"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">{filtered.length} מתוך {rows.length} תלמידים</p>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {filtered.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
            <span className="font-medium">{r.name}</span>
            {r.todayStatus ? (
              <Badge variant="outline">היום: {STATUS_LABELS[r.todayStatus]}</Badge>
            ) : (
              <Badge variant="secondary">ללא רישום היום</Badge>
            )}
            {r.attendancePercent !== null && <Badge variant="outline">נוכחות {r.attendancePercent}%</Badge>}
            {r.gradeAvg !== null && <Badge variant="outline">ממוצע {r.gradeAvg}%</Badge>}
            {r.behaviorPoints !== 0 && <Badge variant="outline">{r.behaviorPoints > 0 ? "+" : ""}{r.behaviorPoints} נק'</Badge>}
            {r.disciplineCount > 0 && <Badge variant="outline">{r.disciplineCount} רישומים</Badge>}
            <StudentHistoryDialog
              studentId={r.id}
              studentName={r.name}
              trigger={
                <Button size="sm" variant="ghost" className="ms-auto h-auto py-0.5 text-[11px]">
                  היסטוריה
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

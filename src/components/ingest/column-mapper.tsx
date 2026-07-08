import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table2, Wand2 } from "lucide-react";
import { ROSTER_TARGET_FIELDS, type RosterTargetField, type RosterTabular } from "@/lib/ingest.functions";

const FIELD_LABEL: Record<RosterTargetField, string> = {
  ignore: "— התעלם —",
  name: "שם התלמיד",
  national_id: "ת.ז. תלמיד",
  birth_date: "תאריך לידה",
  address: "כתובת",
  father_name: "שם האב",
  father_id: "ת.ז. האב",
  father_phone: "טלפון האב",
  mother_name: "שם האם",
  mother_id: "ת.ז. האם",
  mother_phone: "טלפון האם",
};

export function ColumnMapper({
  tabular, mapping, onChange, onApply, applying,
}: {
  tabular: RosterTabular;
  mapping: RosterTargetField[];
  onChange: (next: RosterTargetField[]) => void;
  onApply: () => void;
  applying: boolean;
}) {
  const preview = tabular.rows.slice(0, 3);
  const dirty = mapping.some((m, i) => m !== tabular.mapping[i]);

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Table2 className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">מיפוי עמודות מהקובץ הטבלאי</span>
        <Badge variant="outline">{tabular.headers.length} עמודות</Badge>
        <Badge variant="secondary">{tabular.rows.length} שורות</Badge>
        <span className="text-[11px] text-muted-foreground me-auto">
          המערכת ניחשה מיפוי אוטומטי — עדכן ידנית אם צריך, ואז לחץ "החל מיפוי".
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {tabular.headers.map((h, i) => (
                <th key={i} className="border p-2 text-start min-w-[160px] align-top">
                  <div className="font-semibold truncate" title={h}>{h}</div>
                  <div className="mt-1">
                    <Label className="sr-only">מיפוי {h}</Label>
                    <Select
                      value={mapping[i] ?? "ignore"}
                      onValueChange={(v) => {
                        const next = [...mapping];
                        next[i] = v as RosterTargetField;
                        onChange(next);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROSTER_TARGET_FIELDS.map((f) => (
                          <SelectItem key={f} value={f}>{FIELD_LABEL[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, ri) => (
              <tr key={ri} className="odd:bg-background even:bg-muted/10">
                {tabular.headers.map((_, ci) => (
                  <td key={ci} className="border p-2 align-top truncate max-w-[220px]" title={row[ci]}>
                    {row[ci] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 justify-end">
        {dirty && <span className="text-[11px] text-amber me-auto">שינויים במיפוי לא הוחלו עדיין</span>}
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          onClick={onApply}
          disabled={applying}
        >
          <Wand2 className="ms-1 h-4 w-4" />
          {applying ? "מחיל..." : dirty ? "החל מיפוי וטען מחדש שורות" : "החל מיפוי מחדש"}
        </Button>
      </div>
    </div>
  );
}
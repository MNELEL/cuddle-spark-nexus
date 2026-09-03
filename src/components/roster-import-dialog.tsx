import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ACCEPT_SPREADSHEET, validateUploadFile } from "@/lib/upload-accept";
import { importStudents } from "@/lib/seating-configs.functions";
import {
  ROSTER_FIELD_LABELS, buildRosterStudents, guessMapping, mappingHasName,
  type RosterField, type RosterMapping,
} from "@/lib/roster-import";

const FIELDS: RosterField[] = [
  "ignore", "full_name", "first_name", "middle_name", "last_name",
  "height", "row_pref", "corner_pref", "notes",
];

/**
 * ייבוא רשימת התלמידים האמיתית של הכיתה מקובץ אקסל:
 * זיהוי עמודות אוטומטי, מיפוי ידני, תצוגה מקדימה וסינון כפילויות לפני הכתיבה.
 */
export function RosterImportDialog({
  classId,
  existingNames,
}: {
  classId: string;
  existingNames: string[];
}) {
  const qc = useQueryClient();
  const imp = useServerFn(importStudents);
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<RosterMapping>({});

  const result = useMemo(
    () => buildRosterStudents(rows, mapping, existingNames),
    [rows, mapping, existingNames],
  );

  const importM = useMutation({
    mutationFn: () => imp({ data: { class_id: classId, students: result.students } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      toast.success(`יובאו ${r.count} תלמידים`);
      setOpen(false);
      setRows([]);
      setHeaders([]);
      setFileName("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בייבוא"),
  });

  const onFile = async (file: File) => {
    const check = validateUploadFile(file, ACCEPT_SPREADSHEET);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const first = wb.SheetNames[0];
      const sheet = first ? wb.Sheets[first] : undefined;
      if (!sheet) {
        toast.error("לא נמצא גיליון בקובץ");
        return;
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!json.length) {
        toast.error("הגיליון ריק");
        return;
      }
      const cols = Object.keys(json[0] ?? {});
      setHeaders(cols);
      setMapping(guessMapping(cols));
      setRows(json);
      setFileName(file.name);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בקריאת הקובץ");
    }
  };

  const nameOk = mappingHasName(mapping);

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_SPREADSHEET}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
        <Upload className="h-4 w-4" aria-hidden />
        ייבוא מאקסל
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden />
              ייבוא רשימת תלמידים
            </DialogTitle>
            <DialogDescription>
              {fileName} · {rows.length} שורות בקובץ. התאם כל עמודה לשדה במערכת ובדוק את התצוגה
              המקדימה לפני הייבוא.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {headers.map((h) => (
              <div key={h}>
                <Label htmlFor={`map-${h}`}>{h || "(עמודה ללא כותרת)"}</Label>
                <Select
                  value={mapping[h] ?? "ignore"}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v as RosterField }))}
                >
                  <SelectTrigger id={`map-${h}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {ROSTER_FIELD_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {!nameOk && (
            <p className="text-sm text-destructive">
              חובה למפות עמודה אחת לפחות ל״שם מלא״ או ל״שם פרטי״/״שם משפחה״.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{result.students.length} תלמידים לייבוא</Badge>
            {result.skipped > 0 && <Badge variant="outline">{result.skipped} שורות ללא שם</Badge>}
            {result.duplicatesInFile.length > 0 && (
              <Badge variant="outline">{result.duplicatesInFile.length} כפילויות בקובץ</Badge>
            )}
            {result.existingMatches.length > 0 && (
              <Badge variant="outline">{result.existingMatches.length} קיימים בכיתה</Badge>
            )}
          </div>

          {result.students.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 font-medium">שם</th>
                    <th className="p-2 font-medium">גובה</th>
                    <th className="p-2 font-medium">העדפת שורה</th>
                    <th className="p-2 font-medium">פינה</th>
                    <th className="p-2 font-medium">הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.slice(0, 10).map((s) => (
                    <tr key={s.name} className="border-t">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2">
                        {({ low: "נמוך", mid: "בינוני", high: "גבוה" })[s.height]}
                      </td>
                      <td className="p-2">
                        {(
                          { front: "קדמית", mid: "אמצעית", back: "אחורית", any: "לא משנה" }
                        )[s.row_pref]}
                      </td>
                      <td className="p-2">{s.corner_pref ? "כן" : "—"}</td>
                      <td className="p-2 text-muted-foreground">{s.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.students.length > 10 && (
                <p className="p-2 text-xs text-muted-foreground">
                  מוצגות 10 השורות הראשונות מתוך {result.students.length}.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button
              type="button"
              disabled={!nameOk || result.students.length === 0 || importM.isPending}
              onClick={() => importM.mutate()}
            >
              {importM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              ייבא {result.students.length} תלמידים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

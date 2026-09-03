import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download, History, Save, Trash2, FileSpreadsheet, FileText, Braces, GraduationCap, CalendarCheck, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { listStudents } from "@/lib/students.functions";
import { getClass } from "@/lib/classes.functions";
import { listConfigs, saveConfig, loadConfig, deleteConfig } from "@/lib/seating-configs.functions";
import { exportClassGrades, exportClassAttendance, exportResourcesMeta } from "@/lib/data-export.functions";
import { hebrewDateTime } from "@/lib/hebrew-date";
import { RosterImportDialog } from "@/components/roster-import-dialog";

type Student = {
  id: string; name: string;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean; notes: string | null;
  seat_row: number | null; seat_col: number | null;
};

export function ImportExportBar({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listS = useServerFn(listStudents);
  const getC = useServerFn(getClass);

  const listCfg = useServerFn(listConfigs);
  const saveCfg = useServerFn(saveConfig);
  const loadCfg = useServerFn(loadConfig);
  const delCfg = useServerFn(deleteConfig);
  const expGrades = useServerFn(exportClassGrades);
  const expAtt = useServerFn(exportClassAttendance);
  const expRes = useServerFn(exportResourcesMeta);

  const [saveOpen, setSaveOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [cfgName, setCfgName] = useState("");

  // שמות התלמידים הקיימים, כדי שהייבוא מאקסל לא ייצור כפילויות.
  const { data: existingStudents = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  });
  const existingNames = (existingStudents as Student[]).map((s) => s.name);


  const exportExcel = async () => {
    const [cls, students] = await Promise.all([
      getC({ data: { id: classId } }),
      listS({ data: { classId } }),
    ]);
    const rows = (students as Student[]).map((s) => ({
      "שם": s.name,
      "שורה": s.seat_row !== null ? s.seat_row + 1 : "",
      "עמודה": s.seat_col !== null ? s.seat_col + 1 : "",
      "גובה": ({ low: "נמוך", mid: "בינוני", high: "גבוה" })[s.height],
      "העדפת שורה": ({ front: "קדמית", mid: "אמצעית", back: "אחורית", any: "לא משנה" })[s.row_pref],
      "פינה": s.corner_pref ? "כן" : "",
      "הערות": s.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "סידור");
    XLSX.writeFile(wb, `${cls?.name ?? "כיתה"}-סידור.xlsx`);
  };

  const exportPDF = async () => {
    const grid = document.getElementById("seating-grid-canvas");
    if (!grid) { toast.error("לא נמצא גריד הושבה"); return; }
    toast.info("מכין PDF...");
    const canvas = await html2canvas(grid, { backgroundColor: "#ffffff", scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height) * 2.83;
    const w = canvas.width * ratio / 2.83;
    const h = canvas.height * ratio / 2.83;
    pdf.addImage(img, "PNG", (pdfW - w) / 2, (pdfH - h) / 2, w, h);
    pdf.save("seating.pdf");
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const toCsv = (rows: Record<string, unknown>[]): string => {
    if (rows.length === 0) return "";
    const cols = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>()));
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  };

  const doExport = async (kind: "grades" | "attendance" | "resources", format: "csv" | "json") => {
    try {
      const rows = kind === "grades"
        ? await expGrades({ data: { classId } })
        : kind === "attendance"
        ? await expAtt({ data: { classId } })
        : await expRes();
      if (!rows.length) { toast.info("אין נתונים לייצוא"); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      const base = `${kind}-${stamp}`;
      if (format === "json") {
        downloadBlob(JSON.stringify(rows, null, 2), `${base}.json`, "application/json");
      } else {
        downloadBlob("\uFEFF" + toCsv(rows as Record<string, unknown>[]), `${base}.csv`, "text/csv;charset=utf-8");
      }
      toast.success(`יוצאו ${rows.length} רשומות`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
    }
  };

  const { data: configs = [] } = useQuery({
    queryKey: ["configs", classId],
    queryFn: () => listCfg({ data: { classId } }),
    enabled: histOpen,
  });

  const saveM = useMutation({
    mutationFn: () => saveCfg({ data: { class_id: classId, name: cfgName.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["configs", classId] });
      setSaveOpen(false); setCfgName("");
      toast.success("הסידור נשמר");
    },
  });
  const loadM = useMutation({
    mutationFn: (id: string) => loadCfg({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      qc.invalidateQueries({ queryKey: ["class", classId] });
      setHistOpen(false);
      toast.success("הסידור נטען");
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => delCfg({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configs", classId] }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RosterImportDialog classId={classId} existingNames={existingNames} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline"><Download className="ms-1 h-4 w-4" /> ייצוא</Button>

        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportExcel}>
            <FileSpreadsheet className="ms-2 h-4 w-4" /> Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportPDF}>
            <FileText className="ms-2 h-4 w-4" /> PDF (גריד)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("grades", "csv")}>
            <GraduationCap className="ms-2 h-4 w-4" /> ציונים · CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("grades", "json")}>
            <Braces className="ms-2 h-4 w-4" /> ציונים · JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("attendance", "csv")}>
            <CalendarCheck className="ms-2 h-4 w-4" /> נוכחות · CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("attendance", "json")}>
            <Braces className="ms-2 h-4 w-4" /> נוכחות · JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("resources", "csv")}>
            <Library className="ms-2 h-4 w-4" /> ספריית חומרים · CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport("resources", "json")}>
            <Braces className="ms-2 h-4 w-4" /> ספריית חומרים · JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Save className="ms-1 h-4 w-4" /> שמור סידור</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>שמירת סידור נוכחי</DialogTitle></DialogHeader>
          <div>
            <Label>שם הסידור</Label>
            <Input value={cfgName} onChange={(e) => setCfgName(e.target.value)} placeholder="סידור סמסטר א" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>ביטול</Button>
            <Button onClick={() => saveM.mutate()} disabled={!cfgName.trim() || saveM.isPending}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><History className="ms-1 h-4 w-4" /> סידורים שמורים</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>סידורים שמורים</DialogTitle></DialogHeader>
          {configs.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">אין סידורים שמורים.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {configs.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{hebrewDateTime(c.created_at)}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => loadM.mutate(c.id)} disabled={loadM.isPending}>טען</Button>
                      <Button size="icon" variant="ghost" className="text-destructive" aria-label={`מחק את ${c.name}`} onClick={() => delM.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
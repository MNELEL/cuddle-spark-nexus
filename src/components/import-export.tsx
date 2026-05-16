import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download, Upload, History, Save, Trash2, FileSpreadsheet, FileText } from "lucide-react";
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
import { importStudents, listConfigs, saveConfig, loadConfig, deleteConfig } from "@/lib/seating-configs.functions";

type Student = {
  id: string; name: string;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean; notes: string | null;
  seat_row: number | null; seat_col: number | null;
};

const HEIGHT_MAP: Record<string, "low" | "mid" | "high"> = {
  "low": "low", "mid": "mid", "high": "high",
  "נמוך": "low", "בינוני": "mid", "גבוה": "high",
};
const ROW_MAP: Record<string, "front" | "mid" | "back" | "any"> = {
  "front": "front", "mid": "mid", "back": "back", "any": "any",
  "קדמית": "front", "אמצעית": "mid", "אחורית": "back", "לא משנה": "any",
};

export function ImportExportBar({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listS = useServerFn(listStudents);
  const getC = useServerFn(getClass);
  const imp = useServerFn(importStudents);
  const listCfg = useServerFn(listConfigs);
  const saveCfg = useServerFn(saveConfig);
  const loadCfg = useServerFn(loadConfig);
  const delCfg = useServerFn(deleteConfig);

  const fileInput = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [cfgName, setCfgName] = useState("");

  const importM = useMutation({
    mutationFn: (rows: Parameters<typeof imp>[0]["data"]["students"]) =>
      imp({ data: { class_id: classId, students: rows } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      toast.success(`יובאו ${r.count} תלמידים`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בייבוא"),
  });

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = rows.map((r) => {
        const name = String(r["שם"] ?? r["name"] ?? r["Name"] ?? "").trim();
        const heightRaw = String(r["גובה"] ?? r["height"] ?? "mid").trim().toLowerCase();
        const rowRaw = String(r["שורה"] ?? r["row_pref"] ?? "any").trim().toLowerCase();
        const corner = String(r["פינה"] ?? r["corner_pref"] ?? "").trim().toLowerCase();
        const notes = String(r["הערות"] ?? r["notes"] ?? "");
        return {
          name,
          height: HEIGHT_MAP[heightRaw] ?? "mid",
          row_pref: ROW_MAP[rowRaw] ?? "any",
          corner_pref: ["1", "true", "כן", "yes", "v"].includes(corner),
          notes,
        };
      }).filter((r) => r.name);
      if (!parsed.length) { toast.error("לא נמצאו שורות תקפות"); return; }
      importM.mutate(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בקריאת הקובץ");
    }
  };

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
    XLSX.writeFile(wb, `${cls.name}-סידור.xlsx`);
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
      <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={importM.isPending}>
        <Upload className="ms-1 h-4 w-4" /> ייבוא Excel
      </Button>
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
            <Input value={cfgName} onChange={(e) => setCfgName(e.target.value)} placeholder='למשל "סידור סמסטר א'"' />
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
                      <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("he-IL")}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => loadM.mutate(c.id)} disabled={loadM.isPending}>טען</Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => delM.mutate(c.id)}>
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
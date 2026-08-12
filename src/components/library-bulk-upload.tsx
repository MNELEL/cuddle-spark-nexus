import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, UploadCloud, CheckCircle2, AlertTriangle, FileText, Sparkles,
  Image as ImageIcon, Music, Film, Presentation, FolderOpen, Mic, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import {
  RESOURCE_TYPES, RESOURCE_TYPE_LABELS, upsertResource,
  type ResourceType,
} from "@/lib/teaching-resources.functions";
import { createUploadedResource } from "@/lib/library-extras.functions";
import { analyzeExistingResource } from "@/lib/resource-understanding.functions";

type ItemState = {
  name: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error";
  note?: string;
};

function cleanName(name: string) {
  return name.replace(/[^\w.\-\u0590-\u05FF]+/g, "_").slice(-80);
}

/** קבוצות קבצים נתמכות — לחיצה פותחת את בוחר הקבצים עם הסינון המתאים */
const FILE_KINDS: { id: string; label: string; icon: typeof FileText; accept: string }[] = [
  { id: "pdf", label: "PDF", icon: FileText, accept: "application/pdf" },
  { id: "word", label: "Word", icon: FileText, accept: ".doc,.docx,.rtf,.txt" },
  { id: "audio", label: "אודיו", icon: Music, accept: "audio/*" },
  { id: "record", label: "הקלטה", icon: Mic, accept: "audio/*" },
  { id: "video", label: "סרטון", icon: Film, accept: "video/*" },
  { id: "slides", label: "מצגת", icon: Presentation, accept: ".ppt,.pptx" },
  { id: "image", label: "תמונה", icon: ImageIcon, accept: "image/*" },
  { id: "other", label: "אחר", icon: FolderOpen, accept: "" },
];

const ALL_ACCEPT = "image/*,audio/*,video/*,application/pdf,.doc,.docx,.rtf,.txt,.ppt,.pptx";

export function LibraryBulkUpload({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const createFn = useServerFn(createUploadedResource);
  const analyzeFn = useServerFn(analyzeExistingResource);
  const saveFn = useServerFn(upsertResource);
  const [items, setItems] = useState<ItemState[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"files" | "text">("files");
  const [accept, setAccept] = useState(ALL_ACCEPT);
  const [dragOver, setDragOver] = useState(false);
  const [subject, setSubject] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType | "">("");
  const [pending, setPending] = useState<File[]>([]);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  const update = (i: number, p: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const pickFiles = (kindAccept: string) => {
    setAccept(kindAccept || ALL_ACCEPT);
    // מאפשר לדפדפן להחיל את ה-accept המעודכן לפני פתיחת הבוחר
    window.setTimeout(() => inputRef.current?.click(), 0);
  };

  const addFiles = (fileList: FileList | File[] | null) => {
    const incoming = fileList ? Array.from(fileList) : [];
    if (inputRef.current) inputRef.current.value = "";
    if (incoming.length === 0) return;
    setPending((prev) => {
      const merged = [...prev, ...incoming].slice(0, 20);
      if (prev.length + incoming.length > 20) toast.error("אפשר להעלות עד 20 קבצים בפעם אחת");
      return merged;
    });
  };

  const uploadPending = async () => {
    const files = pending;
    if (files.length === 0) {
      toast.error("בחר קבצים להעלאה");
      return;
    }
    setItems(files.map((f) => ({ name: f.name, status: "pending" as const })));
    setRunning(true);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("נדרשת התחברות מחדש");
      setRunning(false);
      return;
    }

    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        update(i, { status: "uploading" });
        const path = `${uid}/${Date.now()}-${i}-${cleanName(file.name)}`;
        const up = await supabase.storage.from("teaching-resources").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);
        const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "חומר חדש";
        const { id } = await createFn({
          data: {
            title,
            file_path: path,
            mime_type: file.type || "",
            subject,
            resource_type: resourceType,
          },
        });
        update(i, { status: "analyzing" });
        try {
          const res = await analyzeFn({ data: { id, force: false } });
          update(i, {
            status: "done",
            note: res.ocr_added
              ? `חולצו ${res.ocr_chars.toLocaleString("he-IL")} תווים · סווג אוטומטית`
              : "נשמר וסווג",
          });
        } catch {
          update(i, { status: "done", note: "נשמר בספרייה — הניתוח האוטומטי לא הצליח" });
        }
        ok++;
      } catch (e) {
        update(i, { status: "error", note: e instanceof Error ? e.message : "העלאה נכשלה" });
      }
    }

    setRunning(false);
    setPending([]);
    qc.invalidateQueries({ queryKey: ["teaching-resources"] });
    toast.success(`הועלו ${ok} מתוך ${files.length} קבצים`);
  };

  const savePasted = async () => {
    const body = pasteText.trim();
    if (body.length < 20) {
      toast.error("הדבק טקסט ארוך יותר");
      return;
    }
    setRunning(true);
    try {
      const { id } = await saveFn({
        data: {
          title: pasteTitle.trim() || body.slice(0, 60),
          subject,
          resource_type: (resourceType || "other") as ResourceType,
          content: { original_text: body, source_kind: "upload" },
          source_prompt: "מקור: הדבקת טקסט לספרייה",
        },
      });
      try {
        await analyzeFn({ data: { id, force: false } });
      } catch {
        /* הניתוח לא חובה */
      }
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      toast.success("הטקסט נשמר בספרייה וסווג");
      setPasteText("");
      setPasteTitle("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !running) {
          setItems([]);
          setPending([]);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <UploadCloud className="h-4 w-4 text-amber" /> העלאת חומרים לספרייה
          </DialogTitle>
        </DialogHeader>

        {/* טאבים: קבצים / טקסט */}
        <div className="flex gap-2 rounded-xl border bg-muted/40 p-1" role="tablist" aria-label="אופן ההעלאה">
          {([
            { id: "files", label: "קבצים", icon: FolderOpen },
            { id: "text", label: "טקסט", icon: FileText },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${tab === t.id ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:bg-card/60"}`}
            >
              <t.icon className="ms-1 inline h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={accept}
          onChange={(e) => addFiles(e.target.files)}
        />

        {tab === "files" && (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => pickFiles(ALL_ACCEPT)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFiles(ALL_ACCEPT); } }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${dragOver ? "border-amber bg-amber/10" : "hover:border-amber/50 hover:bg-accent/40"}`}
            >
              <UploadCloud className="mb-1 h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <div className="text-sm font-semibold">גרור קבצים לכאן או לחץ לבחירה</div>
              <div className="text-xs text-muted-foreground">
                PDF, Word, מצגת, תמונות, אודיו, וידאו — כמה קבצים בבת אחת
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FILE_KINDS.map((k) => (
                <Button
                  key={k.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-center"
                  disabled={running}
                  onClick={() => pickFiles(k.accept)}
                >
                  <k.icon className="ms-1 h-4 w-4 text-muted-foreground" /> {k.label}
                </Button>
              ))}
            </div>

            {pending.length > 0 && (
              <ul className="space-y-1 text-xs">
                {pending.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`הסר את ${f.name}`}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                      onClick={() => setPending((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "text" && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs" htmlFor="paste-title">כותרת (אופציונלי)</Label>
              <Input id="paste-title" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="שם החומר…" />
            </div>
            <div>
              <Label className="text-xs" htmlFor="paste-text">הדבק את הטקסט</Label>
              <Textarea
                id="paste-text" dir="rtl" rows={10} value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="הדבק כאן טקסט מלא של חומר לימוד, מבחן או סיכום…"
              />
            </div>
          </div>
        )}

        {/* פרטים משותפים */}
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs text-muted-foreground">
            פרטים משותפים — ה-AI ימלא אוטומטית אם תשאיר ריק
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={subject || "auto"} onValueChange={(v) => setSubject(v === "auto" ? "" : v)}>
              <SelectTrigger aria-label="נושא"><SelectValue placeholder="נושא (אוטומטי)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">נושא (אוטומטי)</SelectItem>
                {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resourceType || "auto"} onValueChange={(v) => setResourceType(v === "auto" ? "" : (v as ResourceType))}>
              <SelectTrigger aria-label="קטגוריה"><SelectValue placeholder="קטגוריה (אוטומטי)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">קטגוריה (אוטומטי)</SelectItem>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {items.length > 0 && (
          <ul className="space-y-1 text-xs" aria-live="polite">
            {items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5"
              >
                <span className="truncate">{it.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  {it.status === "uploading" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> מעלה…
                    </>
                  )}
                  {it.status === "analyzing" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> מנתח…
                    </>
                  )}
                  {it.status === "pending" && "בהמתנה"}
                  {it.status === "done" && (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {it.note}
                    </>
                  )}
                  {it.status === "error" && (
                    <>
                      <AlertTriangle className="h-3 w-3 text-destructive" /> {it.note}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={running}
            onClick={() => {
              setItems([]);
              setPending([]);
              onClose();
            }}
          >
            ביטול
          </Button>
          <Button
            disabled={running || (tab === "files" ? pending.length === 0 : pasteText.trim().length < 20)}
            onClick={() => void (tab === "files" ? uploadPending() : savePasted())}
          >
            {running
              ? <Loader2 className="ms-1 h-4 w-4 animate-spin" />
              : <Sparkles className="ms-1 h-4 w-4" />}
            העלה + ניתוח AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

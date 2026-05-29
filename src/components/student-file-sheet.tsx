import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Phone, MessageCircle, Mail, Users, Plus, Trash2,
  Download, Upload, ShieldAlert, ShieldCheck, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listStudentDocuments, upsertStudentDocument, deleteStudentDocument, getDocumentSignedUrl,
  listParentCommunications, upsertParentCommunication, deleteParentCommunication,
  listDisciplineEvents, upsertDisciplineEvent, deleteDisciplineEvent,
} from "@/lib/student-files.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  studentId: string;
  studentName: string;
};

const docCategoryLabel: Record<string, string> = {
  assessment: "אבחון",
  parent_letter: "מכתב להורים",
  scan: "צילום מסמך",
  history: "היסטוריה",
  general: "כללי",
};

const channelLabel: Record<string, string> = {
  phone: "טלפון",
  whatsapp: "וואטסאפ",
  meeting: "פגישה",
  email: "מייל",
  other: "אחר",
};

const channelIcon: Record<string, typeof Phone> = {
  phone: Phone,
  whatsapp: MessageCircle,
  meeting: Users,
  email: Mail,
  other: FileText,
};

export function StudentFileSheet(props: Props) {
  const { open, onOpenChange, studentName } = props;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">תיק תלמיד · {studentName}</SheetTitle>
          <SheetDescription>
            מסמכים, יומן שיחות עם הורים ויומן אירועים משמעתיים — כל ההיסטוריה במקום אחד.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="documents" dir="rtl" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="documents" className="flex-1">
              <FileText className="ms-1 h-4 w-4" /> מסמכים
            </TabsTrigger>
            <TabsTrigger value="parents" className="flex-1">
              <Phone className="ms-1 h-4 w-4" /> שיחות עם הורים
            </TabsTrigger>
            <TabsTrigger value="discipline" className="flex-1">
              <ShieldAlert className="ms-1 h-4 w-4" /> משמעת
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-4">
            <DocumentsPanel {...props} />
          </TabsContent>
          <TabsContent value="parents" className="mt-4">
            <ParentCommsPanel {...props} />
          </TabsContent>
          <TabsContent value="discipline" className="mt-4">
            <DisciplinePanel {...props} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Documents ---------------- */

function DocumentsPanel({ classId, studentId }: Props) {
  const list = useServerFn(listStudentDocuments);
  const upsert = useServerFn(upsertStudentDocument);
  const remove = useServerFn(deleteStudentDocument);
  const getUrl = useServerFn(getDocumentSignedUrl);
  const qc = useQueryClient();

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["student-docs", studentId],
    queryFn: () => list({ data: { studentId } }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"assessment" | "parent_letter" | "scan" | "history" | "general">("general");
  const [schoolYear, setSchoolYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["student-docs", studentId] });

  const removeM = useMutation({
    mutationFn: (d: { id: string; file_path: string | null }) => remove({ data: d }),
    onSuccess: () => { invalidate(); toast.success("המסמך נמחק"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  async function handleAdd() {
    if (!title.trim()) { toast.error("הזן כותרת"); return; }
    setUploading(true);
    try {
      let filePath: string | null = null;
      let mime: string | null = null;
      let size: number | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${classId}/${studentId}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from("student-files").upload(path, file);
        if (error) throw new Error(error.message);
        filePath = path;
        mime = file.type || null;
        size = file.size;
      }
      await upsert({ data: {
        class_id: classId, student_id: studentId,
        title: title.trim(), description, category,
        file_path: filePath, mime_type: mime, file_size: size,
        school_year: schoolYear || null,
      }});
      setTitle(""); setDescription(""); setSchoolYear(""); setFile(null);
      invalidate();
      toast.success("המסמך נוסף");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file_path: string) {
    try {
      const { url } = await getUrl({ data: { file_path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>כותרת</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: אבחון פסיכודידקטי 2024" />
            </div>
            <div>
              <Label>קטגוריה</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assessment">אבחון</SelectItem>
                  <SelectItem value="parent_letter">מכתב להורים</SelectItem>
                  <SelectItem value="scan">צילום מסמך</SelectItem>
                  <SelectItem value="history">היסטוריה (שנים קודמות)</SelectItem>
                  <SelectItem value="general">כללי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>שנת לימודים</Label>
              <Input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="2024-2025" />
            </div>
            <div className="col-span-2">
              <Label>הערות</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>קובץ (אופציונלי)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={uploading} className="w-full">
            {uploading ? <>מעלה...</> : <><Upload className="ms-1 h-4 w-4" /> הוסף מסמך</>}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground py-6">טוען...</p>
      ) : docs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">אין מסמכים עדיין.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <Card key={d.id} className="transition hover:border-amber/40">
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{d.title}</span>
                    <Badge variant="secondary">{docCategoryLabel[d.category] ?? d.category}</Badge>
                    {d.school_year && <Badge variant="outline">{d.school_year}</Badge>}
                  </div>
                  {d.description && <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono-tabular">
                    {new Date(d.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex gap-1">
                  {d.file_path && (
                    <Button size="icon" variant="ghost" onClick={() => handleDownload(d.file_path)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive"
                    onClick={() => removeM.mutate({ id: d.id, file_path: d.file_path })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Parent Communications ---------------- */

function ParentCommsPanel({ classId, studentId }: Props) {
  const list = useServerFn(listParentCommunications);
  const upsert = useServerFn(upsertParentCommunication);
  const remove = useServerFn(deleteParentCommunication);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["parent-comms", studentId],
    queryFn: () => list({ data: { studentId } }),
  });

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState<"phone" | "whatsapp" | "meeting" | "email" | "other">("phone");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["parent-comms", studentId] });

  const addM = useMutation({
    mutationFn: () => upsert({ data: {
      class_id: classId, student_id: studentId,
      date, channel, subject, summary,
      follow_up_date: followUp || null,
    }}),
    onSuccess: () => {
      invalidate();
      setSubject(""); setSummary(""); setFollowUp("");
      toast.success("השיחה תועדה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("נמחק"); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תאריך</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>ערוץ</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">טלפון</SelectItem>
                  <SelectItem value="whatsapp">וואטסאפ</SelectItem>
                  <SelectItem value="meeting">פגישה</SelectItem>
                  <SelectItem value="email">מייל</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>נושא</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="לדוגמה: עדכון על התנהגות" />
            </div>
            <div className="col-span-2">
              <Label>תקציר השיחה</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>תאריך פולו-אפ (אופציונלי)</Label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => addM.mutate()} disabled={!summary.trim() || addM.isPending} className="w-full">
            <Plus className="ms-1 h-4 w-4" /> תעד שיחה
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">אין שיחות מתועדות.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((c: any) => {
            const Icon = channelIcon[c.channel] ?? FileText;
            return (
              <Card key={c.id}>
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{c.subject || channelLabel[c.channel]}</span>
                      <Badge variant="secondary">{channelLabel[c.channel]}</Badge>
                      <span className="text-xs text-muted-foreground font-mono-tabular">
                        {new Date(c.date).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.summary}</p>
                    {c.follow_up_date && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> פולו-אפ: {new Date(c.follow_up_date).toLocaleDateString("he-IL")}
                      </p>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive"
                    onClick={() => removeM.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Discipline Events ---------------- */

function DisciplinePanel({ classId, studentId }: Props) {
  const list = useServerFn(listDisciplineEvents);
  const upsert = useServerFn(upsertDisciplineEvent);
  const remove = useServerFn(deleteDisciplineEvent);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["discipline-events", studentId],
    queryFn: () => list({ data: { studentId } }),
  });

  const [type, setType] = useState<"positive" | "negative">("positive");
  const [category, setCategory] = useState("השתתפות");
  const [severity, setSeverity] = useState(2);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [parentsNotified, setParentsNotified] = useState(false);
  const [filter, setFilter] = useState<"all" | "positive" | "negative">("all");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["discipline-events", studentId] });

  const addM = useMutation({
    mutationFn: () => upsert({ data: {
      class_id: classId, student_id: studentId,
      type, category, severity, description, date,
      parents_notified: parentsNotified,
    }}),
    onSuccess: () => { invalidate(); setDescription(""); toast.success("האירוע נרשם"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("נמחק"); },
  });

  const filtered = filter === "all" ? items : (items as any[]).filter((e) => e.type === filter);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>סוג</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">חיובי</SelectItem>
                  <SelectItem value="negative">שלילי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>קטגוריה</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label>תאריך</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>חומרה (1-5)</Label>
              <Input type="number" min={1} max={5} value={severity}
                onChange={(e) => setSeverity(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
            </div>
            <div className="col-span-2">
              <Label>תיאור</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={parentsNotified} onChange={(e) => setParentsNotified(e.target.checked)} />
              ההורים עודכנו
            </label>
          </div>
          <Button onClick={() => addM.mutate()} disabled={!description.trim() || addM.isPending} className="w-full">
            <Plus className="ms-1 h-4 w-4" /> רשום אירוע
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>הכל</Button>
        <Button size="sm" variant={filter === "positive" ? "default" : "outline"} onClick={() => setFilter("positive")}>
          <ShieldCheck className="ms-1 h-3 w-3" /> חיובי
        </Button>
        <Button size="sm" variant={filter === "negative" ? "default" : "outline"} onClick={() => setFilter("negative")}>
          <ShieldAlert className="ms-1 h-3 w-3" /> שלילי
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">אין אירועים.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e: any) => (
            <Card key={e.id} className={e.type === "positive" ? "border-r-4 border-r-emerald-500" : "border-r-4 border-r-destructive"}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.type === "positive"
                      ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      : <ShieldAlert className="h-4 w-4 text-destructive" />}
                    <Badge variant="secondary">{e.category}</Badge>
                    <Badge variant="outline">חומרה {e.severity}</Badge>
                    <span className="text-xs text-muted-foreground font-mono-tabular">
                      {new Date(e.date).toLocaleDateString("he-IL")}
                    </span>
                    {e.parents_notified && <Badge variant="default">הורים עודכנו</Badge>}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{e.description}</p>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive"
                  onClick={() => removeM.mutate(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
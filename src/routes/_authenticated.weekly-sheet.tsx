import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HomeQuickNav } from "@/components/home-quick-nav";
import { listClasses } from "@/lib/classes.functions";
import { parashaForWeek, weekStartOf } from "@/lib/parasha";
import {
  makeDefaultWeeklySheet, readWeeklySheetDraft, writeWeeklySheetDraft,
  type WeeklySheetDraft,
} from "@/lib/weekly-sheet";

export const Route = createFileRoute("/_authenticated/weekly-sheet")({
  component: WeeklySheetPage,
  head: () => ({
    meta: [
      { title: "דף קשר שבועי להורים · הכיתה שלי" },
      {
        name: "description",
        content: "הפקת דף קשר שבועי להורים: הספק החומר לפי מקצועות, מבחנים, הודעות ודף חתימת הורים — מוכן להדפסה בעברית.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type ClassRow = { id: string; name: string };

function WeeklySheetPage() {
  const listCls = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listCls() });

  const [classId, setClassId] = useState("general");
  const [draft, setDraft] = useState<WeeklySheetDraft>(() => makeDefaultWeeklySheet({}));
  const [exporting, setExporting] = useState(false);

  // הפרשה הנוכחית והטיוטה השמורה נקראות רק בצד הדפדפן.
  useEffect(() => {
    const className = (classes as ClassRow[]).find((c) => c.id === classId)?.name ?? "";
    const saved = readWeeklySheetDraft(classId);
    if (saved) {
      setDraft({ ...saved, className: saved.className || className });
      return;
    }
    setDraft(
      makeDefaultWeeklySheet({
        className,
        parasha: parashaForWeek(weekStartOf(new Date())) ?? "",
      }),
    );
  }, [classId, classes]);

  const update = (patch: Partial<WeeklySheetDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      writeWeeklySheetDraft(classId, next);
      return next;
    });
  };

  const setSubject = (index: number, content: string) => {
    update({
      subjects: draft.subjects.map((s, i) => (i === index ? { ...s, content } : s)),
    });
  };

  async function handleExport() {
    setExporting(true);
    try {
      const { exportWeeklySheetPdf } = await import("@/lib/pdf/weekly-sheet-pdf");
      await exportWeeklySheetPdf(draft);
    } catch {
      toast.error("הפקת הדף נכשלה. נסה שוב.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
          <Mail className="h-7 w-7 text-primary" aria-hidden="true" /> דף קשר שבועי להורים
        </h1>
        <p className="text-sm text-muted-foreground">
          מלא את הספק החומר של השבוע, המבחנים וההודעות — והמערכת מפיקה דף קשר מוכן להדפסה:
          שער, עמוד הספק ודף חתימת הורים עם שדות הערכה. הפרטים נשמרים אצלך לשבוע הבא.
        </p>
        <div className="mt-2"><HomeQuickNav /></div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle as="h2" className="text-sm">כיתה ושבוע</CardTitle>
          <CardDescription>הפרשה מזוהה אוטומטית לפי השבוע הנוכחי — אפשר לשנות.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>כיתה</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger aria-label="בחירת כיתה"><SelectValue placeholder="כללי" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">כללי (בלי שיוך)</SelectItem>
                {(classes as ClassRow[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cls-name">שם הכיתה כפי שיודפס</Label>
            <Input id="cls-name" maxLength={60} value={draft.className}
              onChange={(e) => update({ className: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="parasha">פרשת השבוע</Label>
            <Input id="parasha" maxLength={40} value={draft.parasha}
              onChange={(e) => update({ parasha: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="year">שנה עברית</Label>
            <Input id="year" maxLength={20} placeholder='תשפ"ו' value={draft.hebrewYear}
              onChange={(e) => update({ hebrewYear: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="teacher">שם המלמד</Label>
            <Input id="teacher" maxLength={80} value={draft.teacherName}
              onChange={(e) => update({ teacherName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">טלפון המלמד</Label>
            <Input id="phone" inputMode="tel" maxLength={40} value={draft.teacherPhone}
              onChange={(e) => update({ teacherPhone: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle as="h2" className="text-sm">הספק החומר לפי מקצועות</CardTitle>
          <CardDescription>לדוגמה: "מסכת יומא פרק א' משניות ג' - ח'".</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.subjects.map((s, i) => (
            <div key={s.subject} className="space-y-1">
              <Label htmlFor={`subj-${i}`}>{s.subject}</Label>
              <Input id={`subj-${i}`} maxLength={200} value={s.content}
                onChange={(e) => setSubject(i, e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle as="h2" className="text-sm">מבחנים, הודעות ויישר כח</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="exams">מבחנים השבוע</Label>
            <Textarea id="exams" rows={3} maxLength={800} value={draft.exams}
              placeholder="ביום א' מבחן בכתב במשנה, ביום ג' מבחן בדקדוק…"
              onChange={(e) => update({ exams: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ann">הודעות להורים</Label>
            <Textarea id="ann" rows={3} maxLength={1200} value={draft.announcements}
              onChange={(e) => update({ announcements: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="praise">יישר כח לתלמידים</Label>
            <Textarea id="praise" rows={2} maxLength={600} value={draft.praise}
              onChange={(e) => update({ praise: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="guide">הנחיות להורים (שורה לכל הנחיה)</Label>
            <Textarea id="guide" rows={4} maxLength={1500} value={draft.guidelines.join("\n")}
              onChange={(e) => update({ guidelines: e.target.value.split("\n") })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fields">שדות הערכה בדף החתימה (שורה לכל שדה)</Label>
            <Textarea id="fields" rows={4} maxLength={600} value={draft.evalFields.join("\n")}
              onChange={(e) => update({ evalFields: e.target.value.split("\n") })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="return">מועד החזרת הדף</Label>
            <Input id="return" maxLength={60} value={draft.returnBy}
              onChange={(e) => update({ returnBy: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleExport} disabled={exporting}>
          {exporting
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <FileDown className="h-4 w-4" aria-hidden="true" />}
          הפקת דף הקשר ל-PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const fresh = makeDefaultWeeklySheet({
              className: draft.className,
              teacherName: draft.teacherName,
              parasha: parashaForWeek(weekStartOf(new Date())) ?? "",
              hebrewYear: draft.hebrewYear,
            });
            setDraft(fresh);
            writeWeeklySheetDraft(classId, fresh);
            toast.success("הדף אופס לשבוע חדש");
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          איפוס לשבוע חדש
        </Button>
      </div>
    </div>
  );
}
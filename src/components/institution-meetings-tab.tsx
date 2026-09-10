import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarCheck, FileDown, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CertificateTemplateSelect } from "@/components/certificate-template-select";
import { TeacherMeetingsDialog, exportMeetingPdf } from "@/components/teacher-meetings-dialog";
import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { hebrewDate } from "@/lib/hebrew-date";
import {
  listInstitutionMeetings,
  getInstitutionMeetingsReport,
  type MeetingsReport,
} from "@/lib/teacher-meetings.functions";

/** טאב "פגישות": סיכום פגישות 1:1 לכל מלמד במוסד, כולל דוח, תקציר AI וייצוא PDF. */
export function InstitutionMeetingsTab({ canEdit }: { canEdit: boolean }) {
  const fetchAll = useServerFn(listInstitutionMeetings);
  const fetchReport = useServerFn(getInstitutionMeetingsReport);
  const [design, setDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["institution-meetings"],
    queryFn: () => fetchAll(),
  });
  const groups = q.data ?? [];

  const reportQ = useQuery({
    queryKey: ["institution-meetings-report"],
    queryFn: () => fetchReport({ data: {} }) as Promise<MeetingsReport>,
  });
  const report = reportQ.data;

  const aiM = useMutation({
    mutationFn: () => fetchReport({ data: { withAi: true } }) as Promise<MeetingsReport>,
    onSuccess: (r) => {
      if (!r.aiSummary) return toast.error("לא התקבל תקציר. נסה שוב בעוד רגע.");
      setAiSummary(r.aiSummary);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפקת התקציר נכשלה"),
  });

  return (
    <div className="space-y-6">
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">דוח פגישות לפי מלמדים וכיתות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reportQ.isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : reportQ.isError ? (
          <p className="py-4 text-center text-sm text-destructive">טעינת הדוח נכשלה.</p>
        ) : !report || report.teachers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">אין נתוני פגישות לדוח.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              סה״כ <span className="font-mono-tabular">{report.totalMeetings}</span> פגישות במוסד
            </p>
            <ul className="divide-y text-sm">
              {report.teachers.map((t) => (
                <li key={t.teacherId} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">הרב {t.teacherName}</div>
                    <div className="text-xs text-muted-foreground">
                      כיתות: {t.classNames.join(", ") || "ללא"}
                      {t.lastMeetingDate ? ` · פגישה אחרונה: ${hebrewDate(t.lastMeetingDate)}` : ""}
                      {t.openFollowUps.length > 0
                        ? ` · מעקבים: ${t.openFollowUps.map((d) => hebrewDate(d)).join(", ")}`
                        : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-mono-tabular">{t.meetingCount}</Badge>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={aiM.isPending}
              onClick={() => aiM.mutate()}
            >
              {aiM.isPending
                ? <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
                : <Sparkles className="me-1 h-4 w-4" aria-hidden="true" />}
              תקציר AI לדוח
            </Button>
            {aiSummary && (
              <div className="rounded-xl bg-muted/50 p-3 text-sm whitespace-pre-wrap">{aiSummary}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          פגישות 1:1 עם המלמדים
        </CardTitle>
        <CertificateTemplateSelect
          value={templateId}
          onChange={(id, d) => { setTemplateId(id); setDesign(d); }}
        />
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="טוען פגישות">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : q.isError ? (
          <p className="py-6 text-center text-sm text-destructive">טעינת הפגישות נכשלה. רענן את הדף.</p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין עדיין פגישות מתועדות במוסד.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {groups.map((g) => (
              <AccordionItem key={g.teacherId} value={g.teacherId}>
                <AccordionTrigger className="text-sm">
                  <span className="flex flex-1 items-center justify-between gap-2 pe-2">
                    <span className="truncate">הרב {g.teacherName}</span>
                    <Badge variant="outline" className="font-mono-tabular">{g.meetings.length} פגישות</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void exportMeetingPdf(g.teacherName, g.meetings, design)}
                    >
                      <FileDown className="me-1 h-4 w-4" aria-hidden="true" />
                      PDF לכל הפגישות
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setTarget({ userId: g.teacherId, name: g.teacherName })}
                    >
                      פתיחת יומן הפגישות
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {g.meetings.map((m) => (
                      <li key={m.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              {hebrewDate(m.meetingDate)} · {m.adminName}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{m.summary}</p>
                            {m.actionItems && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                <span className="font-medium">מטלות: </span>{m.actionItems}
                              </p>
                            )}
                            {m.followUpDate && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                <span className="font-medium">תאריך מעקב: </span>{hebrewDate(m.followUpDate)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            aria-label="הפקת PDF לפגישה"
                            onClick={() => void exportMeetingPdf(g.teacherName, [m], design)}
                          >
                            <FileDown className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      <TeacherMeetingsDialog teacher={target} canEdit={canEdit} onClose={() => setTarget(null)} />
    </Card>
    </div>
  );
}

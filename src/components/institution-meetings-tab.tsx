import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CertificateTemplateSelect } from "@/components/certificate-template-select";
import { TeacherMeetingsDialog, exportMeetingPdf } from "@/components/teacher-meetings-dialog";
import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { hebrewDate } from "@/lib/hebrew-date";
import { listInstitutionMeetings } from "@/lib/teacher-meetings.functions";

/** טאב "פגישות": סיכום פגישות 1:1 לכל מלמד במוסד, כולל ייצוא PDF. */
export function InstitutionMeetingsTab({ canEdit }: { canEdit: boolean }) {
  const fetchAll = useServerFn(listInstitutionMeetings);
  const [design, setDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ userId: string; name: string } | null>(null);

  const q = useQuery({
    queryKey: ["institution-meetings"],
    queryFn: () => fetchAll(),
  });
  const groups = q.data ?? [];

  return (
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
  );
}

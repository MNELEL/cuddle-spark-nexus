import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Download, Trash2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResourceSignedUrl } from "@/lib/teaching-resources.functions";
import {
  clearUploadLog, formatSize, listUploadLog, removeUploadLogEntry,
  type UploadLogEntry,
} from "@/lib/upload-log";
import { hebrewDateTime } from "@/lib/hebrew-date";

export const Route = createFileRoute("/_authenticated/resources/upload-log")({
  component: UploadLogPage,
  head: () => ({
    meta: [
      { title: "יומן העלאות לספרייה · הכיתה שלי" },
      { name: "description", content: "סטטוס כל העלאה לספריית חומרי ההוראה: הצלחה או כשל, פרטי הקובץ והורדה מחדש." },
      { property: "og:title", content: "יומן העלאות לספרייה · הכיתה שלי" },
      { property: "og:description", content: "מה עלה, מה נכשל ולמה — עם הורדה מחדש של קבצים שהועלו." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Filter = "all" | "success" | "error";

function UploadLogPage() {
  const [entries, setEntries] = useState<UploadLogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const signFn = useServerFn(getResourceSignedUrl);

  useEffect(() => { setEntries(listUploadLog()); }, []);

  const shown = entries.filter((e) => filter === "all" || e.status === filter);
  const failed = entries.filter((e) => e.status === "error").length;

  const download = async (entry: UploadLogEntry) => {
    if (!entry.filePath) { toast.error("לקובץ הזה אין נתיב שמור — אפשר להעלות אותו מחדש בספרייה"); return; }
    try {
      const { url } = await signFn({ data: { file_path: entry.filePath } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הורדה נכשלה");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4" dir="rtl">
      <Link to="/resources" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowRight className="h-4 w-4" /> חזרה לספרייה
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold">יומן העלאות לספרייה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          כל העלאה נרשמת במכשיר הזה עם סטטוס ופרטי הקובץ. אפשר להוריד מחדש קבצים שנשמרו,
          ולראות בדיוק מה נכשל ולמה.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "הכול"], ["success", "הצליחו"], ["error", "נכשלו"]] as const).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => setFilter(key)}
          >
            {label}
            {key === "error" && failed > 0 && <span className="ms-1 font-mono-tabular">({failed})</span>}
          </Button>
        ))}
        {entries.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto rounded-xl"
            onClick={() => { clearUploadLog(); setEntries([]); toast.success("היומן נוקה"); }}
          >
            <Trash2 className="ms-1 h-4 w-4" /> נקה יומן
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            אין רשומות ביומן. אחרי העלאה לספרייה הרשומות יופיעו כאן.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => (
            <li key={e.id}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle as="h2" className="flex items-center gap-2 text-sm">
                    {e.status === "success"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      : <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />}
                    <span className="truncate">{e.name}</span>
                  </CardTitle>
                  <Badge variant={e.status === "success" ? "secondary" : "destructive"}>
                    {e.status === "success" ? "הצלחה" : "כשל"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2 font-mono-tabular">
                    <span>{hebrewDateTime(e.at)}</span>
                    <span>· {formatSize(e.sizeBytes)}</span>
                    {e.mimeType && <span>· {e.mimeType}</span>}
                  </div>
                  {e.error && <p className="text-destructive">שגיאה: {e.error}</p>}
                  <div className="flex flex-wrap gap-2">
                    {e.status === "success" && e.resourceId && (
                      <Link to="/resources/$resourceId" params={{ resourceId: e.resourceId }}>
                        <Button size="sm" variant="outline" className="rounded-xl">פתח את החומר</Button>
                      </Link>
                    )}
                    {e.filePath && (
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void download(e)}>
                        <Download className="ms-1 h-4 w-4" /> הורדה מחדש
                      </Button>
                    )}
                    {e.status === "error" && (
                      <Link to="/resources">
                        <Button size="sm" className="rounded-xl">נסה להעלות שוב</Button>
                      </Link>
                    )}
                    <Button
                      size="sm" variant="ghost" className="rounded-xl"
                      onClick={() => { removeUploadLogEntry(e.id); setEntries(listUploadLog()); }}
                    >
                      הסר מהיומן
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

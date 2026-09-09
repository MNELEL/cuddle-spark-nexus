import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeCertificateTemplate,
  saveCertificateTemplate,
  listCertificateTemplates,
  deleteCertificateTemplate,
  DEFAULT_CERT_DESIGN,
  FRAME_STYLES,
  CORNER_DECORATIONS,
  TITLE_WEIGHTS,
  TITLE_ALIGNMENTS,
  LAYOUT_DENSITIES,
  type CertTemplateDesign,
} from "@/lib/ai-certificate.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartUpload } from "@/components/smart-upload";
import { ACCEPT_IMAGE } from "@/lib/upload-accept";
import { hebrewDateLabel } from "@/lib/hebrew-date";

/** תוויות בעברית לכל ערך מותר, כדי שהמלמד יראה טקסט קריא ולא ערכים טכניים. */
const FRAME_HE: Record<string, string> = {
  double_border: "מסגרת כפולה",
  single_border: "מסגרת יחידה",
  ornate: "מסגרת מעוטרת",
  none: "בלי מסגרת",
};
const CORNER_HE: Record<string, string> = {
  none: "ללא",
  flourish: "עיטור פרחוני",
  rosette: "רוזטה",
  seal: "חותם",
};
const WEIGHT_HE: Record<string, string> = { bold: "מודגש", normal: "רגיל" };
const ALIGN_HE: Record<string, string> = { center: "מרכז", right: "ימין" };
const DENSITY_HE: Record<string, string> = { compact: "דחוס", standard: "רגיל", spacious: "מרווח" };

export function describeDesign(d: CertTemplateDesign): string {
  return [
    `מסגרת: ${FRAME_HE[d.frame_style]}`,
    `קישוט פינה: ${CORNER_HE[d.corner_decoration]}`,
    `צבע עיקרי: ${d.primary_color}`,
    `צבע הדגשה: ${d.accent_color}`,
    `כותרת: ${WEIGHT_HE[d.title_font_weight]}, ${ALIGN_HE[d.title_alignment]}`,
    `פריסה: ${DENSITY_HE[d.layout_density]}`,
  ].join(" · ");
}

/**
 * שלב ראשון בלבד: זיהוי סגנון עיצוב של תעודה מתמונה ושמירתו כתבנית.
 * הפקת ה-PDF הקיימת אינה מושפעת בשלב זה.
 */
export function CertificateTemplateCard() {
  const analyze = useServerFn(analyzeCertificateTemplate);
  const save = useServerFn(saveCertificateTemplate);
  const list = useServerFn(listCertificateTemplates);
  const remove = useServerFn(deleteCertificateTemplate);
  const qc = useQueryClient();

  const [design, setDesign] = useState<CertTemplateDesign | null>(null);
  const [name, setName] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: () => list(),
  });

  const patch = (p: Partial<CertTemplateDesign>) =>
    setDesign((d) => ({ ...(d ?? DEFAULT_CERT_DESIGN), ...p }));

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("התמונה גדולה מ-10MB");
      return;
    }
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        res(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => rej(new Error("קריאה נכשלה"));
      r.readAsDataURL(file);
    });
    setBusy(true);
    const t = toast.loading("מנתח את סגנון התעודה…");
    try {
      const result = await analyze({ data: { imageBase64: b64, mimeType: file.type } });
      setDesign(result);
      if (!sourceNote) setSourceNote(file.name);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
      toast.success("הסגנון זוהה — אפשר לערוך ולשמור", { id: t });
    } catch {
      toast.error("הזיהוי נכשל. נסה תמונה ברורה יותר.", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          name: name.trim(),
          sourceImageNote: sourceNote.trim() || undefined,
          design: design ?? DEFAULT_CERT_DESIGN,
        },
      }),
    onSuccess: () => {
      toast.success("התבנית נשמרה");
      setDesign(null);
      setName("");
      setSourceNote("");
      void qc.invalidateQueries({ queryKey: ["certificate-templates"] });
    },
    onError: () => toast.error("שמירת התבנית נכשלה"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("התבנית נמחקה");
      void qc.invalidateQueries({ queryKey: ["certificate-templates"] });
    },
    onError: () => toast.error("מחיקת התבנית נכשלה"),
  });

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
          נתח סגנון מתעודה
        </CardTitle>
        <CardDescription>
          העלה צילום של תעודה, והמערכת תזהה את סגנון העיצוב בלבד — מסגרת, קישוטים, צבעים ופריסה.
          התוכן (שמות וציונים) אינו נקרא כאן. בשלב זה התבנית נשמרת בלבד ואינה משנה את הפקת התעודה.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SmartUpload
          accept={ACCEPT_IMAGE}
          buttonLabel="העלה תמונה לניתוח סגנון"
          onFile={(f: File) => void onFile(f)}
        />

        {design && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{describeDesign(design)}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">סוג מסגרת</Label>
                <Select value={design.frame_style} onValueChange={(v) => patch({ frame_style: v as CertTemplateDesign["frame_style"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FRAME_STYLES.map((v) => <SelectItem key={v} value={v}>{FRAME_HE[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">קישוט פינות</Label>
                <Select value={design.corner_decoration} onValueChange={(v) => patch({ corner_decoration: v as CertTemplateDesign["corner_decoration"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CORNER_DECORATIONS.map((v) => <SelectItem key={v} value={v}>{CORNER_HE[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground" htmlFor="tpl-primary">צבע עיקרי</Label>
                <div className="flex items-center gap-2">
                  <Input id="tpl-primary" type="color" className="h-9 w-14 p-1" value={design.primary_color}
                    onChange={(e) => patch({ primary_color: e.target.value })} />
                  <span className="font-mono text-xs">{design.primary_color}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground" htmlFor="tpl-accent">צבע הדגשה</Label>
                <div className="flex items-center gap-2">
                  <Input id="tpl-accent" type="color" className="h-9 w-14 p-1" value={design.accent_color}
                    onChange={(e) => patch({ accent_color: e.target.value })} />
                  <span className="font-mono text-xs">{design.accent_color}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">עובי גופן הכותרת</Label>
                <Select value={design.title_font_weight} onValueChange={(v) => patch({ title_font_weight: v as CertTemplateDesign["title_font_weight"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TITLE_WEIGHTS.map((v) => <SelectItem key={v} value={v}>{WEIGHT_HE[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">יישור הכותרת</Label>
                <Select value={design.title_alignment} onValueChange={(v) => patch({ title_alignment: v as CertTemplateDesign["title_alignment"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TITLE_ALIGNMENTS.map((v) => <SelectItem key={v} value={v}>{ALIGN_HE[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">צפיפות פריסה</Label>
                <Select value={design.layout_density} onValueChange={(v) => patch({ layout_density: v as CertTemplateDesign["layout_density"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAYOUT_DENSITIES.map((v) => <SelectItem key={v} value={v}>{DENSITY_HE[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground" htmlFor="tpl-name">שם התבנית</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: תעודת סוף זמן חורף" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busy || !name.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                שמור תבנית
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDesign(null)}>בטל</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm">תבניות שמורות</Label>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">עוד אין תבניות שמורות.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="secondary">{hebrewDateLabel(t.created_at)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{describeDesign(t)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`מחק תבנית ${t.name}`}
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, GitBranch, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { listResources } from "@/lib/teaching-resources.functions";

export type ResourceOption = { id: string; title: string; subject: string; grade: string };

/** רשימת החומרים של המלמד לבחירה במחוללים */
export function useResourceOptions(): ResourceOption[] {
  const list = useServerFn(listResources);
  const { data = [] } = useQuery({
    queryKey: ["resources", "generator-picker"],
    queryFn: () => list({ data: {} }),
  });
  return useMemo(
    () => data.map((r) => ({ id: r.id, title: r.title, subject: r.subject, grade: r.grade_level })),
    [data],
  );
}

/** קבוצת כפתורי בחירה (רמה / היקף / קושי / כמות) בשפה העיצובית של הספרייה */
export function OptionButtons<T extends string | number>({
  legend, options, value, onChange, columns = 2,
}: {
  legend: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = columns === 4 ? "sm:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className={`grid grid-cols-2 gap-2 ${cols}`}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`min-h-9 rounded-lg border px-3 py-2 text-right text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                on ? "border-primary bg-primary/10 font-semibold" : "hover:bg-accent"
              }`}
            >
              <span className="block">{o.label}</span>
              {o.hint && (
                <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OutputPanel({
  text, onTextChange, saving, onSave, saveLabel,
  onSaveVersion, savingVersion, versionButtonLabel,
}: {
  text: string;
  onTextChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  onSaveVersion: () => void;
  savingVersion: boolean;
  versionButtonLabel: string;
}) {
  if (!text) return null;
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">התוצר (ניתן לעריכה)</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => {
              navigator.clipboard.writeText(text).then(
                () => toast.success("הועתק ללוח"),
                () => toast.error("ההעתקה נכשלה"),
              );
            }}
            aria-label="העתק את התוצר ללוח"
          >
            <Copy className="ms-1 h-4 w-4" aria-hidden /> העתק
          </Button>
          <Button
            variant="outline" size="sm" onClick={onSaveVersion} disabled={savingVersion}
            aria-label={versionButtonLabel}
          >
            {savingVersion ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <GitBranch className="ms-1 h-4 w-4" aria-hidden />}
            {versionButtonLabel}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} aria-label={saveLabel}>
            {saving ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="ms-1 h-4 w-4" aria-hidden />}
            {saving ? "שומר…" : "שמור בספרייה"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          dir="rtl"
          rows={16}
          className="min-h-64 bg-muted text-sm leading-relaxed"
          aria-label="עריכת התוצר שהופק"
        />
      </CardContent>
    </Card>
  );
}

export const LEVEL_OPTION_COLUMNS = 4;
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, Save, Loader2, X } from "lucide-react";

import { getBrand, saveBrand, EMPTY_BRAND, type BrandSettings } from "@/lib/brand.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings/brand")({
  component: BrandSettingsPage,
  head: () => ({
    meta: [
      { title: "מיתוג המוסד · ClassAlign Studio" },
      { name: "description", content: "הגדרת שם המוסד והלוגו שיוטמעו בכל התעודות, המסמכים והמיילים להורים." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function BrandSettingsPage() {
  const qc = useQueryClient();
  const load = useServerFn(getBrand);
  const save = useServerFn(saveBrand);
  const [brand, setBrand] = useState<BrandSettings>(EMPTY_BRAND);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    load().then((b) => { setBrand(b); setLoaded(true); }).catch(() => setLoaded(true));
  }, [load]);

  const patch = (p: Partial<BrandSettings>) => setBrand((b) => ({ ...b, ...p }));

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("יש לבחור תמונה"); return; }
    if (f.size > 500_000) { toast.error("הלוגו גדול מדי (עד 500KB)"); return; }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = () => rej(new Error("קריאה נכשלה"));
      r.readAsDataURL(f);
    });
    patch({ logo_data_url: dataUrl });
  };

  const saveM = useMutation({
    mutationFn: () => save({ data: brand }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-settings"] });
      toast.success("המיתוג נשמר. יוטמע בכל המסמכים שיופקו מעכשיו.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">מיתוג המוסד</h1>
        <p className="text-sm text-muted-foreground">
          השם, שורת הכותרת והלוגו יוטמעו אוטומטית בכל התעודות, המסמכים, המיילים להורים ועמודי השיתוף.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">פרטי המוסד</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>לוגו המוסד</Label>
            <div className="mt-1 flex items-center gap-3">
              {brand.logo_data_url ? (
                <div className="relative">
                  <img src={brand.logo_data_url} alt="לוגו" className="h-20 w-20 rounded-lg border object-contain bg-white" />
                  <button
                    type="button"
                    aria-label="הסר לוגו"
                    onClick={() => patch({ logo_data_url: "" })}
                    className="absolute -top-2 -end-2 rounded-full bg-destructive p-1 text-white shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="ms-1 h-4 w-4" /> העלה לוגו
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
                <p className="mt-1 text-xs text-muted-foreground">PNG/JPG עד 500KB. ריבועי מומלץ.</p>
              </div>
            </div>
          </div>

          <div>
            <Label>שם המוסד</Label>
            <Input value={brand.school_name} onChange={(e) => patch({ school_name: e.target.value })} placeholder="ת״ת / ישיבה / ביה״ס" />
          </div>
          <div>
            <Label>שורת כותרת / מוטו</Label>
            <Input value={brand.header_line} onChange={(e) => patch({ header_line: e.target.value })} placeholder="כתובת / סניף / שנת ייסוד" />
          </div>
          <div>
            <Label>שם המחנך / הרב (ברירת מחדל)</Label>
            <Input value={brand.teacher_name_default} onChange={(e) => patch({ teacher_name_default: e.target.value })} />
          </div>
          <div>
            <Label>שם ההנהלה (ברירת מחדל)</Label>
            <Input value={brand.principal_name_default} onChange={(e) => patch({ principal_name_default: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">תצוגה מקדימה של כותרת</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="h-1.5 -mx-4 -mt-4 mb-3 rounded-t-lg bg-slate-900" />
            <div className="flex items-start justify-between gap-3">
              {brand.logo_data_url && (
                <img src={brand.logo_data_url} alt="" className="h-16 w-16 rounded object-contain bg-white" />
              )}
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{brand.school_name || "שם המוסד"}</div>
                {brand.header_line && <div className="text-xs text-muted-foreground">{brand.header_line}</div>}
                <div className="mt-1 h-px w-40 bg-amber-500 ms-auto" />
                <div className="mt-1 text-sm font-semibold">תעודת הערכה</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveM.mutate()} disabled={!loaded || saveM.isPending}>
          {saveM.isPending
            ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר…</>
            : <><Save className="ms-1 h-4 w-4" /> שמור מיתוג</>}
        </Button>
      </div>
    </div>
  );
}

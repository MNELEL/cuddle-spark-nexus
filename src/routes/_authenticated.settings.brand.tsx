import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, Save, Loader2, X, Lock, Building2 } from "lucide-react";

import {
  getBrand,
  saveBrand,
  getInstitutionBrand,
  saveInstitutionBrand,
  EMPTY_BRAND,
  EMPTY_THEME,
  LOCKABLE_BRAND_FIELDS,
  type BrandSettings,
  type LockableBrandField,
} from "@/lib/brand.functions";
import { BrandThemeEditor } from "@/components/brand-theme-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/settings/brand")({
  component: BrandSettingsPage,
  head: () => ({
    meta: [
      { title: "מיתוג המוסד · הכיתה שלי" },
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
  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [inherited, setInherited] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    load()
      .then((b) => {
        setBrand({
          school_name: b.school_name,
          header_line: b.header_line,
          logo_data_url: b.logo_data_url,
          principal_name_default: b.principal_name_default,
          teacher_name_default: b.teacher_name_default,
          primary_color: b.primary_color,
          theme: b.theme ?? EMPTY_THEME,
        });
        setLockedFields(b.lockedFields ?? []);
        setInherited(b.inheritedFields ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [load]);

  const isLocked = (f: string) => lockedFields.includes(f);
  const InheritNote = ({ field }: { field: string }) =>
    isLocked(field) ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> נקבע על ידי המוסד
      </span>
    ) : inherited.includes(field) ? (
      <span className="text-xs text-muted-foreground">ברירת מחדל מהמוסד</span>
    ) : null;

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

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">המיתוג שלי</TabsTrigger>
          <TabsTrigger value="institution">מיתוג המוסד</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="text-base">פרטי המוסד</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>לוגו המוסד</Label> <InheritNote field="logo_data_url" />
            <div className="mt-1 flex items-center gap-3">
              {brand.logo_data_url ? (
                <div className="relative">
                  <img src={brand.logo_data_url} alt={brand.school_name ? `לוגו ${brand.school_name}` : "לוגו המוסד"} className="h-20 w-20 rounded-lg border object-contain bg-white" />
                  <button
                    type="button"
                    aria-label="הסר לוגו"
                    onClick={() => { if (!isLocked("logo_data_url")) patch({ logo_data_url: "" }); }}
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
                <Button type="button" variant="outline" disabled={isLocked("logo_data_url")} onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="ms-1 h-4 w-4" /> העלה לוגו
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
                <p className="mt-1 text-xs text-muted-foreground">PNG/JPG עד 500KB. ריבועי מומלץ.</p>
              </div>
            </div>
          </div>

          <div>
            <Label>שם המוסד</Label> <InheritNote field="school_name" />
            <Input value={brand.school_name} disabled={isLocked("school_name")} onChange={(e) => patch({ school_name: e.target.value })} placeholder="ת״ת / ישיבה / ביה״ס" />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">תגים, כרטסות ומקצועות</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            העיצוב הזה שלך בלבד — אפשר לשנות צבעי תגים, כרטיסי הדפסה ושמות מקצועות בכל עת,
            גם אם המוסד הגדיר ברירת מחדל.
          </p>
          <BrandThemeEditor theme={brand.theme} onChange={(theme) => patch({ theme })} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveM.mutate()} disabled={!loaded || saveM.isPending}>
          {saveM.isPending
            ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר…</>
            : <><Save className="ms-1 h-4 w-4" /> שמור מיתוג</>}
        </Button>
      </div>
        </TabsContent>

        <TabsContent value="institution">
          <InstitutionBrandTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstitutionBrandTab() {
  const qc = useQueryClient();
  const load = useServerFn(getInstitutionBrand);
  const save = useServerFn(saveInstitutionBrand);
  const [state, setState] = useState<BrandSettings>(EMPTY_BRAND);
  const [locked, setLocked] = useState<LockableBrandField[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [hasInstitution, setHasInstitution] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const logoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    load()
      .then((res) => {
        setState(res.brand);
        setLocked((res.lockedFields ?? []) as LockableBrandField[]);
        setCanEdit(res.canEdit);
        setHasInstitution(!!res.institutionId);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [load]);

  const patch = (p: Partial<BrandSettings>) => setState((b) => ({ ...b, ...p }));

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
    mutationFn: () => save({ data: { ...state, locked_fields: locked } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-settings"] });
      toast.success("מיתוג המוסד נשמר וישמש כברירת מחדל לכל המלמדים.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  if (!loaded) {
    return <p className="p-4 text-sm text-muted-foreground">טוען…</p>;
  }

  if (!hasInstitution) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          אינך משויך למוסד. שיוך למוסד נעשה על ידי מנהל המערכת במסך ניהול המשתמשים.
        </CardContent>
      </Card>
    );
  }

  const toggleLock = (field: LockableBrandField, on: boolean) =>
    setLocked((l) => (on ? Array.from(new Set([...l, field])) : l.filter((f) => f !== field)));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> ברירת המחדל של המוסד
            {!canEdit && <Badge variant="secondary">צפייה בלבד</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>לוגו המוסד</Label>
            <div className="mt-1 flex items-center gap-3">
              {state.logo_data_url ? (
                <img src={state.logo_data_url} alt="לוגו המוסד" className="h-20 w-20 rounded-lg border bg-white object-contain" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div>
                <Button type="button" variant="outline" disabled={!canEdit} onClick={() => logoRef.current?.click()}>
                  <ImageIcon className="ms-1 h-4 w-4" /> העלה לוגו
                </Button>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
              </div>
            </div>
          </div>
          <div>
            <Label>שם המוסד</Label>
            <Input value={state.school_name} disabled={!canEdit} onChange={(e) => patch({ school_name: e.target.value })} />
          </div>
          <div>
            <Label>שורת כותרת / מוטו</Label>
            <Input value={state.header_line} disabled={!canEdit} onChange={(e) => patch({ header_line: e.target.value })} />
          </div>
          <div>
            <Label>שם ההנהלה (ברירת מחדל)</Label>
            <Input value={state.principal_name_default} disabled={!canEdit} onChange={(e) => patch({ principal_name_default: e.target.value })} />
          </div>
          <div>
            <Label>שם המחנך / הרב (ברירת מחדל)</Label>
            <Input value={state.teacher_name_default} disabled={!canEdit} onChange={(e) => patch({ teacher_name_default: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">שדות נעולים</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            שדה נעול לא ניתן לשינוי על ידי המלמדים. כל השאר — כולל תגים, כרטסות ושמות מבצעים —
            נשאר בשליטת המלמד.
          </p>
          {LOCKABLE_BRAND_FIELDS.map((field) => (
            <div key={field} className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm">{field === "school_name" ? "שם המוסד" : "לוגו המוסד"}</span>
              <Switch
                checked={locked.includes(field)}
                disabled={!canEdit}
                onCheckedChange={(v) => toggleLock(field, v)}
                aria-label={`נעל ${field === "school_name" ? "שם המוסד" : "לוגו המוסד"}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">עיצוב ברירת מחדל לתגים וכרטסות</CardTitle></CardHeader>
        <CardContent>
          <BrandThemeEditor theme={state.theme} onChange={(theme) => patch({ theme })} />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending
              ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר…</>
              : <><Save className="ms-1 h-4 w-4" /> שמור מיתוג מוסד</>}
          </Button>
        </div>
      )}
    </div>
  );
}

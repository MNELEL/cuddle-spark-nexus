import { Plus, Trash2 } from "lucide-react";
import type { BrandTheme } from "@/lib/brand.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";

const BADGE_ICONS = [
  { id: "award", label: "מדליה" },
  { id: "star", label: "כוכב" },
  { id: "crown", label: "כתר" },
  { id: "scroll", label: "מגילה" },
  { id: "flame", label: "להבה" },
  { id: "heart", label: "לב" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value || "#f59e0b"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" dir="ltr" />
      </div>
    </div>
  );
}

/** Editor for badge / card / subject styling that teachers may fully customize. */
export function BrandThemeEditor({
  theme,
  onChange,
}: {
  theme: BrandTheme;
  onChange: (t: BrandTheme) => void;
}) {
  const patch = (p: Partial<BrandTheme>) => onChange({ ...theme, ...p });
  const subjects = Object.entries(theme.subject_colors);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <ColorField label="צבע תגים והישגים" value={theme.badge_color} onChange={(v) => patch({ badge_color: v })} />
        <div>
          <Label>סמל התג</Label>
          <select
            value={theme.badge_icon}
            onChange={(e) => patch({ badge_icon: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {BADGE_ICONS.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </div>
        <ColorField label="רקע כרטסת / כרטיס הדפסה" value={theme.card_color} onChange={(v) => patch({ card_color: v })} />
        <ColorField label="מסגרת כרטסת" value={theme.card_border_color} onChange={(v) => patch({ card_border_color: v })} />
      </div>

      <div
        className="rounded-lg border p-4"
        style={{ background: theme.card_color, borderColor: theme.card_border_color }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: theme.badge_color }}
          >
            ★
          </span>
          <span className="text-sm font-semibold text-slate-900">כך ייראה תג הישג ובכרטיס ההדפסה</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>צבעי מקצועות</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const next = KODESH_SUBJECTS.find((s) => !(s in theme.subject_colors)) ?? "מקצוע חדש";
              patch({ subject_colors: { ...theme.subject_colors, [next]: theme.badge_color } });
            }}
          >
            <Plus className="ms-1 h-4 w-4" /> הוסף מקצוע
          </Button>
        </div>
        {subjects.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            לא הוגדרו צבעים — המקצועות יוצגו בצבע ברירת המחדל של המערכת.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {subjects.map(([name, color]) => (
              <li key={name} className="flex items-center gap-2">
                <Input
                  value={name}
                  aria-label="שם המקצוע"
                  onChange={(e) => {
                    const rest = { ...theme.subject_colors };
                    delete rest[name];
                    patch({ subject_colors: { ...rest, [e.target.value]: color } });
                  }}
                />
                <input
                  type="color"
                  aria-label={`צבע ${name}`}
                  value={color || "#f59e0b"}
                  onChange={(e) =>
                    patch({ subject_colors: { ...theme.subject_colors, [name]: e.target.value } })
                  }
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-transparent"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`הסר ${name}`}
                  onClick={() => {
                    const rest = { ...theme.subject_colors };
                    delete rest[name];
                    patch({ subject_colors: rest });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

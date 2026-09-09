import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCertificateTemplates,
  type CertificateTemplate,
  type CertTemplateDesign,
} from "@/lib/ai-certificate.functions";

const NONE = "__none__";

/** בוחר תבנית סגנון שמורה להפקת PDF; "ללא" מחזיר undefined ומשאיר את העיצוב הרגיל. */
export function CertificateTemplateSelect({
  value,
  onChange,
  label = "תבנית סגנון",
}: {
  value: string | null;
  onChange: (id: string | null, design: CertTemplateDesign | undefined) => void;
  label?: string;
}) {
  const list = useServerFn(listCertificateTemplates);
  const { data } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: () => list(),
  });
  const templates: CertificateTemplate[] = data ?? [];

  return (
    <div className="flex items-center gap-2">
      <Label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
        <Palette className="h-3.5 w-3.5 text-primary" aria-hidden />
        {label}
      </Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => {
          if (v === NONE) return onChange(null, undefined);
          const t = templates.find((x) => x.id === v);
          onChange(v, t);
        }}
      >
        <SelectTrigger className="h-8 w-48 text-xs" aria-label={label}>
          <SelectValue placeholder="ללא תבנית" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>ללא תבנית (עיצוב רגיל)</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.is_default ? " · ברירת מחדל" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

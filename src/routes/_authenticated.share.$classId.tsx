import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getClassPublicSharing, updateClassPublicSharing } from "@/lib/public-class.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowRight, Copy, ExternalLink, Globe2 } from "lucide-react";

const BASE = typeof window !== "undefined" ? window.location.origin : "https://cuddle-spark-nexus.lovable.app";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

export const Route = createFileRoute("/_authenticated/share/$classId")({
  component: ShareSettings,
  head: () => ({
    meta: [
      { title: "שיתוף עמוד כיתה ציבורי · ClassAlign" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ShareSettings() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getClassPublicSharing);
  const updateFn = useServerFn(updateClassPublicSharing);

  const { data, isLoading } = useQuery({
    queryKey: ["class-sharing", classId],
    queryFn: () => getFn({ data: { classId } }),
  });

  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!data) return;
    setSlug(data.public_slug ?? slugify(data.name ?? ""));
    setEnabled(!!data.public_enabled);
    setHeadline(data.public_headline ?? "");
    setDescription(data.public_description ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          classId,
          slug: slug ? slugify(slug) : null,
          enabled,
          headline: headline.trim() || null,
          description: description.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("ההגדרות נשמרו");
      qc.invalidateQueries({ queryKey: ["class-sharing", classId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicUrl = slug ? `${BASE}/c/${slugify(slug)}` : "";

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">טוען...</div>;

  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <div>
        <Link
          to="/classes/$classId"
          params={{ classId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5" /> חזרה לכיתה
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe2 className="h-7 w-7 text-amber" /> עמוד כיתה ציבורי
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          צור דף לינקבל לכיתה שלך שאפשר לשתף באתר בית הספר, בבלוג או בקבוצת הורים.
          מוצגים בו רק נתונים <strong>מצטברים ואנונימיים</strong> — ממוצעים לפי מקצוע,
          שיעור נוכחות ועלונים שבועיים. ללא שמות תלמידים או פרטים אישיים.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base font-semibold">שיתוף פעיל</Label>
              <p className="text-sm text-muted-foreground">כשמכובה — הקישור מחזיר "לא נמצא".</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">כתובת ייחודית (slug)</Label>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono-tabular text-muted-foreground">{BASE}/c/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={(e) => setSlug(slugify(e.target.value))}
                placeholder="chaim-cohen-class-3"
                className="font-mono-tabular"
              />
            </div>
            <p className="text-xs text-muted-foreground">אותיות אנגליות קטנות, מספרים ומקפים בלבד. 3-40 תווים.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">כותרת ציבורית</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder="כיתה ג׳ אצל הרב חיים · תשפ״ו"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור קצר (מופיע ב-Google וברשתות)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              rows={4}
              placeholder="בכיתתנו לומדים גמרא מסכת ביצה, פרשת שבוע עם רש״י, וחשבון בגישה חוויתית. עדכונים שבועיים על ההתקדמות."
            />
            <p className="text-xs text-muted-foreground">{description.length}/600</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "שומר..." : "שמור"}
            </Button>
            {enabled && publicUrl && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("הקישור הועתק");
                  }}
                >
                  <Copy className="ms-1 h-4 w-4" /> העתק קישור
                </Button>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" type="button">
                    <ExternalLink className="ms-1 h-4 w-4" /> פתח דף
                  </Button>
                </a>
              </>
            )}
          </div>

          {enabled && publicUrl && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground">כתובת לשיתוף</div>
              <div className="mt-1 font-mono-tabular break-all">{publicUrl}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          <h2 className="font-semibold">איך לקשר מהאתר או הבלוג שלי?</h2>
          <p className="text-muted-foreground leading-relaxed">
            העתק את הקישור ושלב אותו כלינק רגיל באתר בית הספר, בפוסט בבלוג או בקבוצת
            ההורים בוואטסאפ. הדף מותאם ל-Google (SEO) ומציג תצוגה מקדימה יפה ברשתות.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong>פרטיות:</strong> לעולם אין שמות תלמידים או ציונים אישיים. רק ממוצעים
            מצטברים, ורק כשיש 3+ ציונים למקצוע.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
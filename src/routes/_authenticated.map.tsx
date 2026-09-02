import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Map as MapIcon, Check, School, Search, FileDown, Info, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { listClasses } from "@/lib/classes.functions";
import { useToolAccess } from "@/hooks/use-tool-access";
import { MAP_SECTIONS, buildSuperSections, type MapItem } from "@/lib/system-map";
import { HebrewDatePanel } from "@/components/hebrew-date-panel";

export const Route = createFileRoute("/_authenticated/map")({
  component: SystemMapPage,
  head: () => ({
    meta: [
      { title: "מפת המערכת · הכיתה שלי" },
      { name: "description", content: "כל המסכים והכלים של הכיתה שלי במקום אחד — חיפוש בעברית, תיאור לכל מסך וייצוא ל-PDF." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SystemMapPage() {
  const list = useServerFn(listClasses);
  const { access } = useToolAccess();
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => list() });
  const [picked, setPicked] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [exporting, setExporting] = useState(false);
  const activeClassId = picked || classes[0]?.id || "";
  const activeClassName =
    classes.find((c: { id: string; name: string }) => c.id === activeClassId)?.name ?? "";
  const canSeeAdmin = Boolean(access?.isAdmin || access?.isPrincipal);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MAP_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (it) =>
          (!it.adminOnly || canSeeAdmin) &&
          (category === "all" || category === s.title) &&
          (q === "" ||
            it.label.toLowerCase().includes(q) ||
            it.sub.toLowerCase().includes(q)),
      ),
    })).filter((s) => s.items.length > 0);
  }, [query, category, canSeeAdmin]);

  const resultCount = visible.reduce((a, s) => a + s.items.length, 0);
  const superSections = useMemo(() => buildSuperSections(visible), [visible]);

  // כשמחפשים או מסננים — ההורים של התוצאות נפתחים אוטומטית; אחרת הכול סגור.
  const searching = query.trim() !== "" || category !== "all";
  const [openSupersManual, setOpenSupersManual] = useState<string[]>([]);
  const [openSubsManual, setOpenSubsManual] = useState<string[]>([]);
  const autoSupers = searching ? superSections.map((s) => s.title) : [];
  const autoSubs = searching
    ? superSections.flatMap((sup) => sup.sections.map((s) => `${sup.title}|${s.title}`))
    : [];
  const openSupers = searching ? autoSupers : openSupersManual;
  const openSubs = searching ? autoSubs : openSubsManual;

  function toggleSuper(title: string) {
    setOpenSupersManual((p) => (p.includes(title) ? p.filter((t) => t !== title) : [...p, title]));
  }
  function toggleSub(key: string) {
    setOpenSubsManual((p) => (p.includes(key) ? p.filter((t) => t !== key) : [...p, key]));
  }


  async function handleExport() {
    setExporting(true);
    try {
      const { exportSystemMapPdf } = await import("@/lib/pdf/system-map-pdf");
      await exportSystemMapPdf(visible, { className: activeClassName || undefined });
    } catch {
      toast.error("הפקת המסמך נכשלה. נסה שוב.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
            <MapIcon className="h-7 w-7 text-primary" aria-hidden="true" /> מפת המערכת
          </h1>
          <p className="text-sm text-muted-foreground">
            כל מה שיש במערכת, בעברית ובלחיצה אחת. בחר את הכיתה שלך — וכל פריט יפתח את המסך שלה.
          </p>
        </div>

        <HebrewDatePanel />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle as="h2" className="flex items-center gap-2 text-sm">
              <School className="h-4 w-4 text-primary" aria-hidden="true" /> הכיתה שאליה הקישורים יובילו
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                עדיין לא הוגדרה כיתה.{" "}
                <Link to="/classes" className="text-primary underline">צור כיתה ראשונה</Link>{" "}
                וכל הקישורים כאן יתחילו לעבוד.
              </p>
            ) : (
              <Select value={activeClassId} onValueChange={setPicked}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש לפי שם או תיאור — למשל: תעודות, נוכחות, מבחן"
                  aria-label="חיפוש במפת המערכת"
                  className="pe-9"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="sm:w-56" aria-label="סינון לפי קטגוריה">
                  <SelectValue placeholder="כל הקטגוריות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקטגוריות</SelectItem>
                  {MAP_SECTIONS.map((s) => (
                    <SelectItem key={s.title} value={s.title}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{resultCount} מסכים מוצגים</p>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || resultCount === 0}>
                {exporting
                  ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : <FileDown className="h-4 w-4" aria-hidden="true" />}
                ייצוא המפה ל-PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {resultCount === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              לא נמצא מסך שמתאים לחיפוש. נסה מילה אחרת או בחר "כל הקטגוריות".
            </CardContent>
          </Card>
        )}

        {superSections.map((sup) => {
          const supOpen = openSupers.includes(sup.title);
          return (
            <Card key={sup.title}>
              <CardHeader className="pb-2">
                <button
                  type="button"
                  onClick={() => toggleSuper(sup.title)}
                  aria-expanded={supOpen}
                  className="flex w-full items-center justify-between gap-2 text-start"
                >
                  <CardTitle as="h2" className="text-base">{sup.title}</CardTitle>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {sup.count} מסכים
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${supOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </CardHeader>
              {supOpen && (
                <CardContent className="space-y-2">
                  {sup.sections.map((section) => {
                    const subKey = `${sup.title}|${section.title}`;
                    const subOpen = openSubs.includes(subKey);
                    return (
                      <div key={subKey} className="rounded-lg border">
                        <button
                          type="button"
                          onClick={() => toggleSub(subKey)}
                          aria-expanded={subOpen}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start"
                        >
                          <span className="text-sm font-medium">{section.title}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {section.items.length}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${subOpen ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                        {subOpen && (
                          <div className="divide-y border-t px-3">
                            {section.items.map((it) => (
                              <MapRow key={`${section.title}-${it.to}-${it.label}`} item={it} classId={activeClassId} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}


        <p className="text-center text-xs text-muted-foreground">
          לא מצאת משהו? כל הכלים מרוכזים גם ב<Link to="/toolkit" className="text-primary underline">ארגז הכלים</Link>.
        </p>
      </div>
    </TooltipProvider>
  );
}

function MapRow({ item, classId }: { item: MapItem; classId: string }) {
  const needsClass = item.to.includes("$classId");
  const disabled = needsClass && !classId;

  const body = (
    <>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
          disabled ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
        }`}
        aria-hidden="true"
      >
        <Check className="h-3 w-3" />
      </span>
      <span>
        <span className="font-medium">{item.label}</span>
        <span className="block text-xs text-muted-foreground">{item.sub}</span>
        {disabled && <span className="block text-xs text-muted-foreground">נדרש ליצור כיתה כדי לפתוח מסך זה</span>}
      </span>
    </>
  );

  return (
    <div className="flex items-start gap-1">
      {disabled ? (
        <div className="flex flex-1 items-start gap-2 py-2.5 text-sm opacity-70">{body}</div>
      ) : (
        <Link
          to={item.to as never}
          params={(needsClass ? { classId } : {}) as never}
          className="flex flex-1 items-start gap-2 rounded-md py-2.5 text-sm hover:bg-accent"
        >
          {body}
        </Link>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mt-2.5 rounded-full p-1 text-muted-foreground hover:text-primary"
            aria-label={`מה עושים ב${item.label}`}
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-right text-xs">
          {item.sub}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

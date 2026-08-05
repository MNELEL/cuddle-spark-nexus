import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  School, Users, Library, ClipboardCheck, Trophy, FileText,
  Check, ArrowUpLeft, Loader2, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOnboardingState, updateOnboardingState, ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "המדריך החכם · הכיתה שלי" },
      { name: "description", content: "מדריך התחלה בשישה שלבים — כיתה, תלמידים, חומרי הוראה, מעקב, מוטיבציה ודוחות." },
      { property: "og:title", content: "המדריך החכם · הכיתה שלי" },
      { property: "og:description", content: "שישה שלבים קצרים כדי להתחיל לעבוד עם המערכת." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Step = {
  id: OnboardingStepId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Semantic surface classes (design tokens only). */
  surface: string;
  iconClass: string;
  checklist: string[];
  action: { label: string; to: string };
};

export const ONBOARDING_STEP_DEFS: Step[] = [
  {
    id: "class",
    title: "1. יצירת הכיתה",
    subtitle: "פותחים כיתה חדשה עם שם, שנת לימוד ומוסד.",
    icon: School,
    surface: "bg-primary/10 border-primary/30",
    iconClass: "text-primary",
    checklist: ["פתיחת כיתה חדשה באשף", "בחירת שנת הלימוד (תשפ״ז)", "שיוך הכיתה למוסד"],
    action: { label: "לניהול כיתות ↗", to: "/classes" },
  },
  {
    id: "students",
    title: "2. הוספת תלמידים",
    subtitle: "מזינים את רשימת התלמידים או מייבאים אותה בהעלאה חכמה.",
    icon: Users,
    surface: "bg-accent/40 border-accent",
    iconClass: "text-accent-foreground",
    checklist: ["הוספת תלמידים לכיתה", "מילוי פרטי הורים וטלפונים", "ייבוא רשימה מקובץ (אופציונלי)"],
    action: { label: "להעלאה חכמה ↗", to: "/ingest" },
  },
  {
    id: "library",
    title: "3. חומרי הוראה",
    subtitle: "בונים ספרייה של מערכי שיעור, דפי עבודה וחידות.",
    icon: Library,
    surface: "bg-secondary border-border",
    iconClass: "text-secondary-foreground",
    checklist: ["הוספת חומר ראשון לספרייה", "סימון מקצוע ורמת קושי", "הפקת סיכום או משימות מהחומר"],
    action: { label: "לספריית חומרי הוראה ↗", to: "/resources" },
  },
  {
    id: "tracking",
    title: "4. מעקב וציונים",
    subtitle: "מזינים ציונים, נוכחות והתנהגות — הבסיס לכל דוח.",
    icon: ClipboardCheck,
    surface: "bg-muted border-border",
    iconClass: "text-foreground",
    checklist: ["רישום ציון ראשון", "סימון נוכחות יומית", "הגדרת שקלול ציונים למקצועות"],
    action: { label: "לכיתות ומעקב ↗", to: "/classes" },
  },
  {
    id: "motivation",
    title: "5. מוטיבציה ופרסים",
    subtitle: "מגדירים נקודות, תגים ומבצעים כיתתיים.",
    icon: Trophy,
    surface: "bg-primary/5 border-primary/20",
    iconClass: "text-primary",
    checklist: ["הגדרת קטלוג פרסים", "יצירת תג הישג ראשון", "פתיחת מבצע כיתתי"],
    action: { label: "לארגז הכלים ↗", to: "/toolkit" },
  },
  {
    id: "reports",
    title: "6. דוחות והורים",
    subtitle: "מפיקים עלון, תעודה או דוח ושולחים להורים.",
    icon: FileText,
    surface: "bg-accent/20 border-accent",
    iconClass: "text-accent-foreground",
    checklist: ["הפקת עלון שבועי", "הפקת תעודה עם מיתוג המוסד", "שליחת עדכון להורים"],
    action: { label: "למסמכים ותבניות ↗", to: "/toolkit" },
  },
];

function OnboardingPage() {
  const fetchState = useServerFn(getOnboardingState);
  const update = useServerFn(updateOnboardingState);
  const qc = useQueryClient();

  const { data: state, isLoading } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
  });

  const mut = useMutation({
    mutationFn: (v: { step?: OnboardingStepId; done?: boolean; dismissed?: boolean }) =>
      update({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
      toast.success("ההתקדמות נשמרה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const completed = new Set<OnboardingStepId>([...(state?.done ?? []), ...(state?.auto ?? [])]);
  const percent = Math.round((completed.size / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden /> המדריך החכם
          </h1>
          <p className="text-sm text-muted-foreground">
            שישה שלבים קצרים מהקמת הכיתה ועד שליחת הדוח הראשון להורים. כל שלב מסומן אוטומטית כשהנתונים קיימים במערכת.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {completed.size} מתוך {ONBOARDING_STEPS.length} הושלמו
        </Badge>
      </div>

      {isLoading ? (
        <Skeleton className="h-3 w-full" />
      ) : (
        <div className="space-y-1">
          <Progress value={percent} aria-label={`התקדמות במדריך: ${percent} אחוז`} />
          <p className="text-xs text-muted-foreground">{percent}% הושלמו</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ONBOARDING_STEP_DEFS.map((step) => {
          const isDone = completed.has(step.id);
          const isAuto = (state?.auto ?? []).includes(step.id);
          const Icon = step.icon;
          return (
            <Card key={step.id} className={`border ${step.surface}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={`h-5 w-5 ${step.iconClass}`} aria-hidden />
                  <span className="flex-1">{step.title}</span>
                  {isDone && (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" aria-hidden /> הושלם
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{step.subtitle}</p>
                <ul className="space-y-1.5 text-sm">
                  {step.checklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${isDone ? "text-primary" : "text-muted-foreground/50"}`}
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button asChild size="sm">
                    <Link to={step.action.to}>
                      {step.action.label}
                      <ArrowUpLeft className="ms-1 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isAuto || mut.isPending}
                    onClick={() => mut.mutate({ step: step.id, done: !(state?.done ?? []).includes(step.id) })}
                    aria-label={
                      isAuto
                        ? `${step.title} סומן אוטומטית לפי הנתונים במערכת`
                        : (state?.done ?? []).includes(step.id)
                          ? `בטל סימון השלמה עבור ${step.title}`
                          : `סמן כהושלם את ${step.title}`
                    }
                  >
                    {mut.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />}
                    {isAuto
                      ? "זוהה אוטומטית"
                      : (state?.done ?? []).includes(step.id) ? "בטל סימון" : "סמן כהושלם"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

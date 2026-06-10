import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar } from "lucide-react";
import { getStyleProfile } from "@/lib/teacher-style.functions";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/teaching-resources.functions";

/** Compact weekly pace + top subjects panel, fed by the teacher style profile. */
export function WeeklyPaceCard() {
  const fetchProfile = useServerFn(getStyleProfile);
  const { data: profile } = useQuery({
    queryKey: ["teacher-style-profile"],
    queryFn: () => fetchProfile(),
  });

  if (!profile || profile.resource_count === 0) return null;

  const pace = profile.weekly_pace ?? {};
  const weeks = Object.entries(pace).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const max = Math.max(1, ...weeks.map(([, n]) => n));
  const total = weeks.reduce((s, [, n]) => s + n, 0);
  const avg = weeks.length ? (total / weeks.length).toFixed(1) : "0";

  const topSubjects = Object.entries(profile.preferred_subjects ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topTypes = Object.entries(profile.preferred_resource_types ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <Card className="border-primary/30 bg-gradient-to-bl from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          קצב ההפקה שלך
          <span className="text-xs font-normal text-muted-foreground">
            סה"כ {profile.resource_count} חומרים · ממוצע {avg} לשבוע
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {weeks.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> 8 חודשים אחרונים
            </div>
            <div className="flex items-end gap-1 h-16">
              {weeks.map(([w, n]) => (
                <div key={w} className="flex-1 flex flex-col items-center gap-1" title={`${w}: ${n}`}>
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${(n / max) * 100}%` }} />
                  <div className="text-[9px] text-muted-foreground">{w.split("-")[1]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {topSubjects.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">מקצועות מועדפים</div>
              <div className="flex flex-wrap gap-1">
                {topSubjects.map(([s, n]) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">{s} · {n}</Badge>
                ))}
              </div>
            </div>
          )}
          {topTypes.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">סוגי חומר מועדפים</div>
              <div className="flex flex-wrap gap-1">
                {topTypes.map(([t, n]) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {RESOURCE_TYPE_LABELS[t as ResourceType] ?? t} · {n}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        {profile.tone_keywords?.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">סגנון / מילים אופייניות</div>
            <div className="flex flex-wrap gap-1">
              {profile.tone_keywords.slice(0, 10).map((k) => (
                <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{k}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
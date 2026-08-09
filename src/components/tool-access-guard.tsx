import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToolAccess } from "@/hooks/use-tool-access";
import { canUseTool, normalizePathname, toolByPath } from "@/lib/tool-registry";

const REASONS: Record<string, string> = {
  classes: "הכלי הזה פועל על כיתה קיימת. צריך ליצור כיתה (או לקבל שיוך לכיתה) כדי להשתמש בו.",
  admin: "הכלי הזה זמין למנהל המערכת בלבד.",
  admin_or_principal: "הכלי הזה זמין למנהל המערכת ולמנהל המוסד בלבד.",
};

/**
 * Blocks tool routes the user has no access to, instead of letting them render
 * a broken/empty screen. Toolkit cards hide the same tools, so this is the
 * backstop for direct links and bookmarks.
 */
export function ToolAccessGuard({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const entry = toolByPath(normalizePathname(pathname));
  const { access, isLoading } = useToolAccess();

  if (!entry || entry.requires === "any") return <>{children}</>;
  if (isLoading || !access) return <>{children}</>;
  if (canUseTool(entry, access)) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-5 w-5" aria-hidden /> אין גישה ל{entry.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{REASONS[entry.requires] ?? "אין הרשאה לכלי הזה."}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to="/toolkit">חזרה לארגז הכלים</Link></Button>
          {entry.requires === "classes" ? (
            <Button asChild size="sm" variant="outline"><Link to="/classes">הכיתות שלי</Link></Button>
          ) : (
            <Button asChild size="sm" variant="outline"><Link to="/settings">בקשת הרשאות</Link></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

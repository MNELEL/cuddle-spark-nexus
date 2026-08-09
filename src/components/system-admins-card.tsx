import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listSystemAdmins } from "@/lib/user-roles.functions";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function SystemAdminsCard() {
  const fetchAdmins = useServerFn(listSystemAdmins);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["system-admins"],
    queryFn: () => fetchAdmins(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" /> מנהל המערכת הנוכחי
        </CardTitle>
        <CardDescription>
          מי מוגדר כמנהל מערכת (admin) ומתי הוגדר — אליו פונים לאישור בקשות הרשאה.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> טוען...
          </div>
        ) : isError ? (
          <p className="py-2 text-sm text-destructive">טעינת מנהלי המערכת נכשלה.</p>
        ) : !data || data.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            אין מנהל מערכת מוגדר. ניתן להשתמש בכפתור "אתחל מנהל מערכת ראשון" כדי להגדיר את החשבון
            הראשון.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{admin.displayName}</span>
                    {admin.isMe && <Badge variant="secondary">זה אתה</Badge>}
                  </div>
                  {admin.email && (
                    <a
                      href={`mailto:${admin.email}`}
                      className="text-xs text-primary hover:underline"
                      dir="ltr"
                    >
                      {admin.email}
                    </a>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  הוגדר בתאריך {formatDate(admin.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

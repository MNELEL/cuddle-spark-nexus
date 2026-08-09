import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2, Copy, Check, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { listSystemAdmins } from "@/lib/user-roles.functions";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(value));
  } catch {
    return value;
  }
}

const CONTACT_SUBJECT = "בקשת הרשאות / סיוע — ClassAlign Studio";

function buildContactBody(adminName: string) {
  return [
    `לכבוד ${adminName},`,
    "",
    "אני מבקש/ת את עזרתך בנושא הרשאות במערכת ClassAlign Studio.",
    "",
    "שם מלא:",
    "מוסד:",
    "התפקיד המבוקש (מלמד / מזכירה / מנהל מוסד):",
    "פרטים נוספים:",
    "",
    "תודה רבה,",
  ].join("\n");
}

function mailtoHref(email: string, adminName: string) {
  return `mailto:${email}?subject=${encodeURIComponent(CONTACT_SUBJECT)}&body=${encodeURIComponent(
    buildContactBody(adminName),
  )}`;
}

export function SystemAdminsCard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyEmail = async (id: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedId(id);
      toast.success("האימייל הועתק");
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error("ההעתקה נכשלה — אפשר לסמן ולהעתיק ידנית");
    }
  };

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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    הוגדר בתאריך {formatDate(admin.assignedAt)}
                  </span>
                  {admin.email && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`העתק את האימייל של ${admin.displayName}`}
                        onClick={() => copyEmail(admin.id, admin.email as string)}
                      >
                        {copiedId === admin.id ? (
                          <Check className="me-1.5 h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="me-1.5 h-4 w-4" />
                        )}
                        {copiedId === admin.id ? "הועתק" : "העתק אימייל"}
                      </Button>
                      <Button asChild variant="secondary" size="sm">
                        <a
                          href={mailtoHref(admin.email, admin.displayName)}
                          aria-label={`שליחת מייל ל${admin.displayName}`}
                        >
                          <Mail className="me-1.5 h-4 w-4" /> שלח מייל
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

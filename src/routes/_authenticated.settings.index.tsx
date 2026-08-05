import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Palette, ArrowLeft, Wrench, Library, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusCard } from "@/components/subscription-status-card";
import { ReminderPreferencesCard } from "@/components/reminder-preferences-card";
import { SecuritySettings } from "@/components/security-settings";
import { useBrand } from "@/hooks/use-brand";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "הגדרות · הכיתה שלי" },
      { name: "description", content: "מרכז ההגדרות: מיתוג המוסד, קוד אבטחה, העדפות תזכורות ומצב תקופת הניסיון." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SettingsPage() {
  const { brand } = useBrand();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
          <Settings className="h-7 w-7 text-primary" /> הגדרות
        </h1>
        <p className="text-sm text-muted-foreground">
          כל ההגדרות האישיות והמוסדיות במקום אחד — מיתוג, אבטחה, תזכורות ומצב המנוי.
        </p>
      </div>

      <SubscriptionStatusCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-5 w-5" /> מיתוג המוסד
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {brand.logo_data_url ? (
              <img
                src={brand.logo_data_url}
                alt={brand.school_name ? `לוגו ${brand.school_name}` : "לוגו המוסד"}
                className="h-12 w-12 rounded-lg border bg-white object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <Palette className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="font-semibold">{brand.school_name || "לא הוגדר שם מוסד"}</div>
              <div className="text-xs text-muted-foreground">
                {brand.header_line || "השם והלוגו מוטמעים בכל התעודות והמסמכים"}
              </div>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link to="/settings/brand">
              עריכת מיתוג <ArrowLeft className="ms-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <ReminderPreferencesCard />

      <SecuritySettings />

      <Card>
        <CardHeader><CardTitle className="text-base">קישורים נוספים</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button asChild variant="ghost" className="justify-start">
            <Link to="/toolkit"><Wrench className="ms-1 h-4 w-4" /> ארגז כלים</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link to="/resources"><Library className="ms-1 h-4 w-4" /> ספרייה</Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start">
            <Link to="/user-management"><ShieldCheck className="ms-1 h-4 w-4" /> ניהול משתמשים</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

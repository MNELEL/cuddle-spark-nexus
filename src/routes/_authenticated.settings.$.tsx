import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsTabs } from "@/components/settings-tabs";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";

export const Route = createFileRoute("/_authenticated/settings/$")({
  component: SettingsNotFoundPage,
  head: () => ({
    meta: [
      { title: "הדף לא נמצא · הגדרות · הכיתה שלי" },
      { name: "description", content: "הכתובת המבוקשת באזור ההגדרות אינה קיימת — חזרה למרכז ההגדרות." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SettingsNotFoundPage() {
  const { _splat } = Route.useParams();
  const attempted = `/settings/${_splat ?? ""}`.replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SettingsBreadcrumb current="לא נמצא" />

      <div>
        <h1 className="font-display flex items-center gap-2 text-3xl font-bold">
          <Settings className="h-7 w-7 text-primary" /> הדף לא נמצא באזור ההגדרות
        </h1>
        <p className="text-sm text-muted-foreground">
          הכתובת שהוקשה אינה קיימת. אפשר לבחור לשונית מהרשימה או לחזור למרכז ההגדרות.
        </p>
      </div>

      <SettingsTabs />

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2 text-base">
            <Compass className="h-4 w-4 text-primary" /> הכתובת שביקשת
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p dir="ltr" className="rounded-md bg-muted px-3 py-2 text-left font-mono text-sm text-muted-foreground">
            {attempted}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/settings">
                <Settings className="ml-2 h-4 w-4" /> חזרה להגדרות
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">
                <Home className="ml-2 h-4 w-4" /> לדף הבית
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
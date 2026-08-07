import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryGenerator } from "@/components/summary-generator";
import { TaskGenerator } from "@/components/task-generator";

export const Route = createFileRoute("/_authenticated/resources/generate")({
  component: GeneratePage,
  head: () => ({
    meta: [
      { title: "הפקת תוצרים מהספרייה · הכיתה שלי" },
      { name: "description", content: "מחולל סיכומים ומחולל משימות — בוחרים חומר מהספרייה, רמת תלמידים והיקף, ומקבלים תוצר מוכן להדפסה." },
      { property: "og:title", content: "הפקת תוצרים מהספרייה · הכיתה שלי" },
      { property: "og:description", content: "סיכומים ומשימות מותאמים מתוך חומרי ההוראה שלך." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function GeneratePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="px-2">
          <Link to="/resources">
            <ChevronRight className="ms-1 h-4 w-4" aria-hidden /> חזרה לספריית חומרי הוראה
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden /> הפקת תוצרים מהספרייה
        </h1>
        <p className="text-sm text-muted-foreground">
          הכיוון ההפוך לספרייה: בוחרים חומר קיים ומפיקים ממנו סיכום לתלמידים או מערך משימות מותאם.
        </p>
      </div>

      <Tabs defaultValue="summary" dir="rtl">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="summary"><FileText className="ms-1 h-4 w-4" aria-hidden /> מחולל סיכומים</TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks className="ms-1 h-4 w-4" aria-hidden /> מחולל משימות</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4"><SummaryGenerator /></TabsContent>
        <TabsContent value="tasks" className="mt-4"><TaskGenerator /></TabsContent>
      </Tabs>
    </div>
  );
}

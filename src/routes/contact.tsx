import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Phone, MessageCircle, Building2, FileDown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { socialImageMeta } from "@/lib/social-meta";

const URL_SELF = "https://hakitasheli.lovable.app/contact";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "צור קשר · הכיתה שלי — תמיכה למלמדים ולמוסדות" },
      { name: "description", content: "יצירת קשר עם הכיתה שלי: תמיכה למלמדים, פניות מוסדות ורשתות חינוך, וזמני מענה. כולל דף קשר מוסדי מוכן להדפסה." },
      { property: "og:title", content: "צור קשר · הכיתה שלי" },
      { property: "og:description", content: "תמיכה למלמדים ופניות מוסדות — כל דרכי הקשר של הכיתה שלי במקום אחד." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_SELF },
      ...socialImageMeta(),
    ],
    links: [{ rel: "canonical", href: URL_SELF }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "צור קשר · הכיתה שלי",
          url: URL_SELF,
        }),
      },
    ],
  }),
});

const CHANNELS = [
  { icon: Mail, title: "תמיכה במייל", body: "שאלות על המערכת, תקלות והצטרפות למסלול הניסיון.", action: "support@hakitasheli.co.il", href: "mailto:support@hakitasheli.co.il" },
  { icon: Building2, title: "מוסדות ורשתות חינוך", body: "הטמעה מרוכזת, הדרכת צוותים ותמחור למוסד.", action: "לעמוד שיתופי הפעולה", to: "/partners" },
  { icon: MessageCircle, title: "משוב והצעות", body: "רעיון לכלי חדש או שיפור? נשמח לשמוע מהשטח.", action: "feedback@hakitasheli.co.il", href: "mailto:feedback@hakitasheli.co.il" },
  { icon: Phone, title: "מענה טלפוני", body: "בימים א׳–ה׳, לפי תיאום מראש במייל.", action: "תיאום שיחה", href: "mailto:support@hakitasheli.co.il?subject=תיאום%20שיחה" },
];

function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold">צור קשר</h1>
        <p className="text-muted-foreground">
          אנחנו כאן בשביל המלמדים והמוסדות. בחר את הערוץ המתאים — נחזור אליך בהקדם.
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" /> זמן מענה: עד יום עסקים אחד.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle as="h2" className="flex items-center gap-2 text-base">
                <c.icon className="h-5 w-5 text-primary" aria-hidden="true" /> {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{c.body}</p>
              {c.to ? (
                <Button asChild variant="outline" size="sm">
                  <Link to={c.to}>{c.action}</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={c.href}>{c.action}</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle as="h2" className="flex items-center gap-2 text-base">
            <FileDown className="h-5 w-5 text-primary" aria-hidden="true" /> דף קשר מוסדי מוכן להדפסה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            למשתמשי המערכת: אפשר לבנות דף קשר של המוסד — הנהלה, צוות, ספקים, בריאות וחירום — עם תבנית שמוזנת מראש
            לפי הספקים המיועדים, ולהפיק אותו כמסמך PDF בעברית עם הלוגו של המוסד.
          </p>
          <Button asChild size="sm">
            <Link to="/contact-sheet">פתיחת דף הקשר במערכת</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

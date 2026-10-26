import { createFileRoute } from "@tanstack/react-router";
import { ClaudeTeacherTool } from "@/components/claude-teacher-tools";
export const Route = createFileRoute("/_authenticated/sugya-generator")({
  head: () => ({ meta: [
    { title: "מחולל סוגיות כיתה עם Claude · ClassAlign Studio" },
    { name: "description", content: "סוגיות כיתה לפי מקצוע ומקום לימוד." },
    { property: "og:title", content: "מחולל סוגיות כיתה · ClassAlign Studio" },
    { property: "og:description", content: "הכנת סוגיות, שאלות דיון והמשך לימוד עם Claude." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: () => <ClaudeTeacherTool mode="sugya" />,
});
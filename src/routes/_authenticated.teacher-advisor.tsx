import { createFileRoute } from "@tanstack/react-router";
import { ClaudeTeacherTool } from "@/components/claude-teacher-tools";
export const Route = createFileRoute("/_authenticated/teacher-advisor")({
  head: () => ({ meta: [
    { title: "היועץ הפדגוגי למלמד · ClassAlign Studio" },
    { name: "description", content: "תוכנית התערבות בשלושה צעדים לדילמות כיתתיות עם Claude." },
    { property: "og:title", content: "היועץ הפדגוגי למלמד · ClassAlign Studio" },
    { property: "og:description", content: "ייעוץ מכבד ומעשי למלמדים בשלושה צעדים." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: () => <ClaudeTeacherTool mode="advisor" />,
});
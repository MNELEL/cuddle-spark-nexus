import { callLovableAI } from "./ai-gateway.server";
import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeIdea } from "./badge-options";

/** Asks Lovable AI for Hebrew badge ideas in a given chinuch category. */
export async function fetchBadgeIdeas(category: BadgeCategory, count: number): Promise<BadgeIdea[]> {
  const raw = await callLovableAI({
    jsonResponse: true,
    messages: [
      {
        role: "system",
        content:
          "אתה עוזר פדגוגי למלמדים בתלמוד תורה וחיידר. החזר JSON בלבד, בעברית ובלשון מכובדת המתאימה לציבור החרדי.",
      },
      {
        role: "user",
        content:
          `הצע ${count} רעיונות לתגי הישג בקטגוריה "${BADGE_CATEGORY_LABELS[category]}".\n` +
          `החזר אובייקט בפורמט: {"ideas":[{"name":"","description":"","criteria":""}]}`,
      },
    ],
  });
  try {
    const parsed = JSON.parse(raw) as { ideas?: Partial<BadgeIdea>[] };
    return (parsed.ideas ?? [])
      .filter((i) => i.name)
      .map((i) => ({
        name: String(i.name).slice(0, 120),
        description: String(i.description ?? "").slice(0, 600),
        criteria: String(i.criteria ?? "").slice(0, 600),
      }));
  } catch {
    throw new Error("קבלת רעיונות מה-AI נכשלה, נסה שוב");
  }
}

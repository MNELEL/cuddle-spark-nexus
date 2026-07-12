import type { QuestionItem } from "@/lib/teaching-resources.functions";
import { RESOURCE_TYPE_LABELS } from "@/lib/teaching-resources.functions";
import {
  createHebrewDoc, drawBrandHeader, drawFooter, downloadPdfBlob, safeName,
} from "./pdf-builder";

export async function exportQuestionsPdf(
  items: QuestionItem[],
  opts?: { title?: string; withAnswers?: boolean },
): Promise<void> {
  const title = opts?.title?.trim() || "מאגר שאלות מוכנות";
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title,
    subtitle: "שאלות שנבחרו מהספרייה",
    meta: `${items.length} שאלות`,
  });

  hd.table({
    head: opts?.withAnswers
      ? [["#", "שאלה", "תשובה", "מקצוע", "כיתה", "מקור"]]
      : [["#", "שאלה", "מקצוע", "כיתה", "מקור"]],
    body: items.map((it, i) => {
      const src = `${RESOURCE_TYPE_LABELS[it.resource_type] ?? it.resource_type} · ${it.resource_title}`;
      return opts?.withAnswers
        ? [String(i + 1), it.q, it.a || "—", it.subject || "—", it.grade_level || "—", src]
        : [String(i + 1), it.q, it.subject || "—", it.grade_level || "—", src];
    }),
    columnStyles: opts?.withAnswers
      ? {
          0: { cellWidth: 9, halign: "center" },
          1: { cellWidth: 60, halign: "right" },
          2: { cellWidth: 50, halign: "right" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 32, halign: "right" },
        }
      : {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 100, halign: "right" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 16, halign: "center" },
          4: { cellWidth: 35, halign: "right" },
        },
  });

  drawFooter(hd, title);
  const blob = hd.doc.output("blob");
  downloadPdfBlob(blob, `${safeName(title)}.pdf`);
}
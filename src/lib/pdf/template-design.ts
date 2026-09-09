import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { AMBER, SLATE } from "./pdf-builder";

/** ממיר קוד צבע hex ל-RGB עבור jsPDF; קלט לא תקין חוזר לצבע ברירת המחדל. */
export function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function designColors(design?: CertTemplateDesign): {
  primary: [number, number, number];
  accent: [number, number, number];
} {
  return {
    primary: hexToRgb(design?.primary_color ?? "", SLATE),
    accent: hexToRgb(design?.accent_color ?? "", AMBER),
  };
}

type FrameDoc = {
  doc: {
    setDrawColor: (r: number, g: number, b: number) => void;
    setLineWidth: (w: number) => void;
    rect: (x: number, y: number, w: number, h: number) => void;
    circle: (x: number, y: number, r: number, style?: string) => void;
    setFillColor: (r: number, g: number, b: number) => void;
  };
  layout: { pageW: number; pageH: number };
};

/**
 * מצייר את המסגרת והקישוטים של תבנית הסגנון השמורה.
 * ללא תבנית — מסגרת כפולה בצבעי המערכת, כמו קודם.
 */
export function drawTemplateFrame(hd: FrameDoc, design?: CertTemplateDesign): void {
  const { doc, layout } = hd;
  const { primary, accent } = designColors(design);
  const style = design?.frame_style ?? "double_border";
  if (style === "none") return;

  const outer = 6;
  doc.setDrawColor(...primary);
  doc.setLineWidth(style === "ornate" ? 1.2 : 0.8);
  doc.rect(outer, outer, layout.pageW - outer * 2, layout.pageH - outer * 2);

  if (style === "double_border" || style === "ornate") {
    const inner = style === "ornate" ? 10 : 9;
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.rect(inner, inner, layout.pageW - inner * 2, layout.pageH - inner * 2);
  }

  const corner = design?.corner_decoration ?? "none";
  if (corner !== "none") {
    const r = corner === "seal" ? 3.2 : corner === "rosette" ? 2.4 : 1.6;
    const pad = 12;
    doc.setFillColor(...accent);
    for (const [x, y] of [
      [pad, pad],
      [layout.pageW - pad, pad],
      [pad, layout.pageH - pad],
      [layout.pageW - pad, layout.pageH - pad],
    ] as [number, number][]) {
      doc.circle(x, y, r, "F");
    }
  }
}

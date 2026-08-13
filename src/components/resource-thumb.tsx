import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Music, Film, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * תצוגה מקדימה אמיתית של המסמך שהועלה:
 * - תמונות — מוצגות מהקובץ עצמו (כתובת חתומה זמנית)
 * - PDF — רינדור העמוד הראשון בדפדפן ל-canvas
 * - שאר הסוגים — אייקון לפי סוג הקובץ
 * טעינה עצלה: מתחיל רק כשהכרטיס נראה על המסך, עם מטמון בזיכרון.
 */

const urlCache = new Map<string, string>();
const pdfCache = new Map<string, string>();

async function signedUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("teaching-resources").createSignedUrl(path, 60 * 30);
  if (!data?.signedUrl) return null;
  urlCache.set(path, data.signedUrl);
  return data.signedUrl;
}

async function renderPdfFirstPage(path: string, url: string): Promise<string | null> {
  const cached = pdfCache.get(path);
  if (cached) return cached;
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
  const doc = await pdfjs.getDocument({ url }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(320 / viewport.width, 1.5);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaled.width);
  canvas.height = Math.ceil(scaled.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvas, canvasContext: ctx, viewport: scaled }).promise;
  const data = canvas.toDataURL("image/jpeg", 0.75);
  pdfCache.set(path, data);
  return data;
}

function FallbackIcon({ mime }: { mime: string }) {
  const cls = "h-8 w-8 text-muted-foreground";
  if (mime.startsWith("image/")) return <ImageIcon className={cls} aria-hidden="true" />;
  if (mime.startsWith("audio/")) return <Music className={cls} aria-hidden="true" />;
  if (mime.startsWith("video/")) return <Film className={cls} aria-hidden="true" />;
  if (mime.includes("presentation")) return <Presentation className={cls} aria-hidden="true" />;
  return <FileText className={cls} aria-hidden="true" />;
}

export function ResourceThumb({
  filePath, mimeType, title, className = "",
}: {
  filePath?: string | null;
  mimeType?: string | null;
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const mime = (mimeType ?? "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isPdf = mime.includes("pdf") || (filePath ?? "").toLowerCase().endsWith(".pdf");

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !filePath || (!isImage && !isPdf)) return;
    let alive = true;
    void (async () => {
      try {
        const url = await signedUrl(filePath);
        if (!url || !alive) return;
        if (isImage) { setSrc(url); return; }
        const data = await renderPdfFirstPage(filePath, url);
        if (alive && data) setSrc(data);
      } catch {
        /* נשארים עם אייקון סוג הקובץ */
      }
    })();
    return () => { alive = false; };
  }, [visible, filePath, isImage, isPdf]);

  return (
    <div
      ref={ref}
      className={`flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 ${className}`}
    >
      {src ? (
        <img src={src} alt={`תצוגה מקדימה של ${title}`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <FallbackIcon mime={mime} />
      )}
    </div>
  );
}

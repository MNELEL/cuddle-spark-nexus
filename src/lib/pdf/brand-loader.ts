import { getBrand } from "@/lib/brand.functions";
import { setPdfBrand } from "./pdf-builder";

let cached: Promise<void> | null = null;

/**
 * Loads the current teacher's institution brand from the server and applies it
 * to the PDF builder (via setPdfBrand). Result is cached per session — call
 * `invalidatePdfBrand()` after saving brand changes.
 *
 * Every PDF generator should `await ensurePdfBrandLoaded()` before drawing
 * headers so that school name, logo and primary color are consistent across
 * every document that leaves the app.
 */
export async function ensurePdfBrandLoaded(): Promise<void> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const brand = await getBrand();
      setPdfBrand({
        schoolName: brand.school_name || undefined,
        headerLine: brand.header_line || undefined,
        logoDataUrl: brand.logo_data_url || undefined,
        primaryColor: brand.primary_color || undefined,
      });
    } catch (e) {
      // Non-fatal: PDFs still render with default styling.
      console.warn("[pdf-brand] failed to load brand settings", e);
    }
  })();
  return cached;
}

export function invalidatePdfBrand(): void {
  cached = null;
}
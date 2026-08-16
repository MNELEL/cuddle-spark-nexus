import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SheetExportResult = {
  ok: true;
  spreadsheetId: string;
  url: string;
  created: boolean;
  rows: number;
  students: number;
};

export const exportClassGradesToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid("מזהה כיתה לא תקין"),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך התחלה לא תקין"),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך סיום לא תקין"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SheetExportResult> => {
    const { exportGradesToGoogleSheet } = await import("./sheets-export.server");
    return exportGradesToGoogleSheet(context.supabase, data);
  });

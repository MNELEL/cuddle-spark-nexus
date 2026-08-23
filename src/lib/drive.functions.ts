import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { driveDownloadFile, driveListFolder, type DriveFile } from "@/lib/drive.server";

/** רשימת קבצים ותיקיות בתוך תיקיית Drive אחת. */
export const listDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ folderId: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => driveListFolder(data.folderId));

export type DriveImportResult = {
  ok: boolean;
  id?: string;
  duplicateId?: string;
  duplicateTitle?: string;
  error?: string;
};

/** ייבוא קובץ Drive בודד: הורדה → בדיקת כפילות → אחסון → יצירת חומר ספרייה. */
export const importDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        file: z.object({
          id: z.string().min(1).max(500),
          name: z.string().min(1).max(500),
          mimeType: z.string().max(300),
        }),
        subject: z.string().max(80).default(""),
        resourceType: z.string().max(40).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DriveImportResult> => {
    const f: DriveFile = { id: data.file.id, name: data.file.name, mimeType: data.file.mimeType, size: null, modifiedTime: null };
    const { supabase, userId } = context;
    try {
      const { bytes, name, mime } = await driveDownloadFile(f);

      // בדיקת כפילות לפי SHA-256 (תואמת העלאה רגילה)
      let hash: string | null = null;
      try {
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        hash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        hash = null;
      }
      if (hash) {
        const { data: existing } = await supabase
          .from("teaching_resources")
          .select("id,title")
          .eq("owner_id", userId)
          .eq("content_hash", hash)
          .limit(1)
          .maybeSingle();
        if (existing) {
          return { ok: true, duplicateId: existing.id, duplicateTitle: existing.title };
        }
      }

      // אחסון + יצירת חומר (מבוסס על createUploadedResource)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const safe = (name.replace(/[^\w.\-\u0590-\u05FF]+/g, "_") || "file").slice(-80);
      const path = `${userId}/drive/${Date.now()}-${safe}`;
      const up = await supabaseAdmin.storage
        .from("teaching-resources")
        .upload(path, bytes, { contentType: mime || "application/octet-stream", upsert: false });
      if (up.error) throw new Error(up.error.message);

      const { data: ins, error } = await supabase
        .from("teaching_resources")
        .insert({
          owner_id: userId,
          title: name.replace(/\.[^.]+$/, "").slice(0, 200) || "חומר מ-Google Drive",
          file_path: path,
          mime_type: mime || null,
          subject: data.subject || null,
          resource_type: data.resourceType || "other",
          content_hash: hash,
          content: { source_kind: "upload" },
          source_prompt: "מקור: ייבוא מ-Google Drive",
        } as never)
        .select("id")
        .single();
      if (error) {
        console.error("[Drive import insert]", error);
        throw new Error("שמירת החומר בספרייה נכשלה");
      }
      return { ok: true, id: (ins as { id: string }).id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "ייבוא הקובץ נכשל" };
    }
  });

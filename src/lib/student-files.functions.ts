import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/* ---------- Documents ---------- */

export const listStudentDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("student_documents")
      .select("*")
      .eq("student_id", data.studentId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertStudentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid.optional(),
    class_id: uuid,
    student_id: uuid,
    category: z.enum(["assessment", "parent_letter", "scan", "history", "general"]).default("general"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().default(""),
    file_path: z.string().max(500).nullable().optional(),
    mime_type: z.string().max(120).nullable().optional(),
    file_size: z.number().int().nonnegative().nullable().optional(),
    school_year: z.string().max(20).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("student_documents").update(rest).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else {
      const { error } = await context.supabase.from("student_documents").insert(data);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });

export const deleteStudentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, file_path: z.string().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.file_path) {
      await context.supabase.storage.from("student-files").remove([data.file_path]);
    }
    const { error } = await context.supabase.from("student_documents").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("student-files")
      .createSignedUrl(data.file_path, 60 * 10);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { url: signed.signedUrl };
  });

/* ---------- Parent communications ---------- */

export const listParentCommunications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("parent_communications")
      .select("*")
      .eq("student_id", data.studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertParentCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid.optional(),
    class_id: uuid,
    student_id: uuid,
    date: z.string(),
    channel: z.enum(["phone", "whatsapp", "meeting", "email", "other"]).default("phone"),
    subject: z.string().max(200).optional().default(""),
    summary: z.string().min(1).max(4000),
    follow_up_date: z.string().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("parent_communications").update(rest).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else {
      const { error } = await context.supabase.from("parent_communications").insert(data);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });

export const deleteParentCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("parent_communications").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/* ---------- Discipline events ---------- */

export const listDisciplineEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("discipline_events")
      .select("*")
      .eq("student_id", data.studentId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertDisciplineEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid.optional(),
    class_id: uuid,
    student_id: uuid,
    type: z.enum(["positive", "negative"]).default("positive"),
    category: z.string().max(80).default("general"),
    severity: z.number().int().min(1).max(5).default(1),
    description: z.string().min(1).max(2000),
    date: z.string(),
    parents_notified: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("discipline_events").update(rest).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else {
      const { error } = await context.supabase.from("discipline_events").insert(data);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });

export const deleteDisciplineEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("discipline_events").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });
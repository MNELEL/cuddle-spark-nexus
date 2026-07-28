import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionSchema = z.string().min(1).max(200);

export type PollRow = {
  id: string;
  class_id: string;
  question: string;
  options: string[];
  status: "active" | "closed";
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PollVoteRow = {
  id: string;
  poll_id: string;
  student_id: string;
  option_index: number;
  created_at: string;
};

export const listPolls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PollRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (context.supabase as any)
      .from("polls").select("*").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[polls list]", error); throw new Error("טעינת הסקרים נכשלה."); }
    return (rows ?? []) as PollRow[];
  });

export const getPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supa = context.supabase as any;
    const { data: poll, error } = await supa.from("polls").select("*").eq("id", data.id).maybeSingle();
    if (error) { console.error("[poll get]", error); throw new Error("טעינת הסקר נכשלה."); }
    if (!poll) throw new Error("הסקר לא נמצא.");
    const { data: votes, error: vErr } = await supa.from("poll_votes").select("*").eq("poll_id", data.id);
    if (vErr) { console.error("[poll votes]", vErr); throw new Error("טעינת ההצבעות נכשלה."); }
    return { poll: poll as PollRow, votes: (votes ?? []) as PollVoteRow[] };
  });

export const createPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      question: z.string().min(1).max(500),
      options: z.array(optionSchema).min(2).max(4),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("polls")
      .insert({
        class_id: data.classId,
        question: data.question,
        options: data.options,
        status: "active",
      })
      .select("id").single();
    if (error || !row) { console.error("[poll create]", error); throw new Error("יצירת הסקר נכשלה."); }
    return { id: row.id as string };
  });

export const closePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("polls").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", data.id);
    if (error) { console.error("[poll close]", error); throw new Error("סגירת הסקר נכשלה."); }
    return { ok: true as const };
  });

export const reopenPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("polls").update({ status: "active", closed_at: null }).eq("id", data.id);
    if (error) { console.error("[poll reopen]", error); throw new Error("פתיחת הסקר נכשלה."); }
    return { ok: true as const };
  });

export const deletePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any).from("polls").delete().eq("id", data.id);
    if (error) { console.error("[poll delete]", error); throw new Error("מחיקת הסקר נכשלה."); }
    return { ok: true as const };
  });

export const setVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      pollId: z.string().uuid(),
      studentId: z.string().uuid(),
      optionIndex: z.number().int().min(0).max(3).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supa = context.supabase as any;
    if (data.optionIndex === null) {
      const { error } = await supa.from("poll_votes").delete()
        .eq("poll_id", data.pollId).eq("student_id", data.studentId);
      if (error) { console.error("[vote clear]", error); throw new Error("הסרת ההצבעה נכשלה."); }
      return { ok: true as const };
    }
    const { error } = await supa.from("poll_votes").upsert({
      poll_id: data.pollId,
      student_id: data.studentId,
      option_index: data.optionIndex,
    }, { onConflict: "poll_id,student_id" });
    if (error) { console.error("[vote upsert]", error); throw new Error("שמירת ההצבעה נכשלה."); }
    return { ok: true as const };
  });
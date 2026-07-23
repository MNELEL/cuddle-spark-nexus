// Daily scheduled job: find overdue reminders across all teachers, group them
// per teacher, and send one summary email each (not one email per reminder).
// Invoked from the Cloudflare Workers `scheduled` handler in src/server.ts.
//
// This is intentionally the ONLY automated, background-triggered notification
// path in the app today. Everything else (NotificationCenter-style UI,
// crm-tab.tsx reminders) requires the teacher to have the app open. This file
// closes that gap for reminders specifically.
//
// TODO(email-provider): actually sending email requires an email provider to
// be connected (Resend is the simplest fit for a Lovable Cloud + Supabase
// project). No such provider is wired up in this project yet. Until one is
// connected, `sendReminderDigestEmail` below only logs what *would* be sent
// and still records the alert as "sent" in `sent_reminder_alerts` so the
// dedup logic can be exercised end-to-end. Once a provider is connected,
// replace the body of `sendReminderDigestEmail` with a real API call and
// remove this TODO.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ReminderRow = {
  id: string;
  class_id: string;
  student_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
};

type TeacherDigest = {
  ownerId: string;
  email: string | null;
  items: {
    reminderId: string;
    title: string;
    dueDate: string | null;
    className: string;
    studentName: string;
  }[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sends (or, until an email provider is connected, logs) one digest email
 * for a single teacher covering all of their overdue reminders.
 *
 * Returns true if the digest should be considered "delivered" for the
 * purpose of marking reminders as alerted (so they aren't re-sent tomorrow).
 * While no provider is connected this always returns true after logging,
 * matching the TODO above — remove the log branch once real sending exists.
 */
async function sendReminderDigestEmail(digest: TeacherDigest): Promise<boolean> {
  if (!digest.email) {
    console.error(
      `[reminder-alerts] No email on file for teacher ${digest.ownerId}; skipping digest for ${digest.items.length} reminder(s).`,
    );
    return false;
  }

  // TODO(email-provider): replace this block with a real call once an email
  // provider (e.g. Resend) is connected to this project.
  console.log(
    `[reminder-alerts] (no email provider connected — logging only) ` +
      `Would send digest to ${digest.email} for ${digest.items.length} overdue reminder(s): ` +
      digest.items.map((i) => `"${i.title}" (${i.studentName}, ${i.className}, due ${i.dueDate})`).join("; "),
  );
  return true;
}

/**
 * Finds every reminder that is overdue (due_date <= today, not completed)
 * and has not already been alerted on (via sent_reminder_alerts), groups
 * them by the owning teacher, sends one digest per teacher, and records
 * each successfully-digested reminder so it is not re-sent on future runs.
 *
 * Failures for one teacher (missing email, send failure, etc.) are logged
 * with enough context to investigate, but do not stop processing for the
 * remaining teachers.
 */
export async function checkOverdueReminders(): Promise<void> {
  const today = todayIso();

  const { data: overdue, error: remindersError } = await supabaseAdmin
    .from("reminders")
    .select("id,class_id,student_id,title,description,due_date,completed")
    .eq("completed", false)
    .lte("due_date", today);

  if (remindersError) {
    console.error("[reminder-alerts] Failed to load overdue reminders:", remindersError);
    return;
  }
  const reminders = (overdue ?? []) as ReminderRow[];
  if (reminders.length === 0) return;

  const { data: alreadySent, error: alertsError } = await supabaseAdmin
    .from("sent_reminder_alerts")
    .select("reminder_id")
    .in(
      "reminder_id",
      reminders.map((r) => r.id),
    );
  if (alertsError) {
    console.error("[reminder-alerts] Failed to load sent_reminder_alerts (continuing without dedup is unsafe, aborting run):", alertsError);
    return;
  }
  const alreadySentIds = new Set((alreadySent ?? []).map((a) => (a as { reminder_id: string }).reminder_id));
  const pending = reminders.filter((r) => !alreadySentIds.has(r.id));
  if (pending.length === 0) return;

  const classIds = Array.from(new Set(pending.map((r) => r.class_id)));
  const studentIds = Array.from(new Set(pending.map((r) => r.student_id)));

  const [classesRes, studentsRes] = await Promise.all([
    supabaseAdmin.from("classes").select("id,name,owner_id").in("id", classIds),
    supabaseAdmin.from("students").select("id,name").in("id", studentIds),
  ]);
  if (classesRes.error) {
    console.error("[reminder-alerts] Failed to load classes for pending reminders:", classesRes.error);
    return;
  }
  if (studentsRes.error) {
    console.error("[reminder-alerts] Failed to load students for pending reminders:", studentsRes.error);
    return;
  }

  const classById = new Map(
    (classesRes.data ?? []).map((c) => [(c as { id: string }).id, c as { id: string; name: string; owner_id: string }]),
  );
  const studentById = new Map(
    (studentsRes.data ?? []).map((s) => [(s as { id: string }).id, s as { id: string; name: string }]),
  );

  // Group pending reminders by the teacher who owns the class.
  const byTeacher = new Map<string, TeacherDigest>();
  for (const r of pending) {
    const cls = classById.get(r.class_id);
    if (!cls) {
      console.error(`[reminder-alerts] Reminder ${r.id} references missing class ${r.class_id}; skipping.`);
      continue;
    }
    const student = studentById.get(r.student_id);
    const entry = byTeacher.get(cls.owner_id) ?? { ownerId: cls.owner_id, email: null, items: [] };
    entry.items.push({
      reminderId: r.id,
      title: r.title,
      dueDate: r.due_date,
      className: cls.name,
      studentName: student?.name ?? "תלמיד",
    });
    byTeacher.set(cls.owner_id, entry);
  }

  for (const digest of byTeacher.values()) {
    try {
      const { data: userRes, error: userError } = await supabaseAdmin.auth.admin.getUserById(digest.ownerId);
      if (userError) {
        console.error(`[reminder-alerts] Failed to load auth user ${digest.ownerId}:`, userError);
        continue;
      }
      digest.email = userRes?.user?.email ?? null;

      const delivered = await sendReminderDigestEmail(digest);
      if (!delivered) continue;

      const { error: insertError } = await supabaseAdmin.from("sent_reminder_alerts").insert(
        digest.items.map((i) => ({ reminder_id: i.reminderId })),
      );
      if (insertError) {
        console.error(
          `[reminder-alerts] Digest for teacher ${digest.ownerId} was sent but recording sent_reminder_alerts failed ` +
            `(these reminders may be re-sent tomorrow):`,
          insertError,
        );
      }
    } catch (err) {
      console.error(`[reminder-alerts] Unexpected error processing teacher ${digest.ownerId}:`, err);
      // Continue with the remaining teachers — one teacher's failure must
      // not block the rest of the run.
    }
  }
}

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
import { logError } from "@/lib/logger.server";
import { Resend } from "resend";

const LOG_SOURCE = "reminder-alerts.server";

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
    void logError(
      `No email on file for teacher ${digest.ownerId}; skipping digest for ${digest.items.length} reminder(s).`,
      {
        source: LOG_SOURCE,
        userId: digest.ownerId,
        context: { ownerId: digest.ownerId, itemCount: digest.items.length },
      },
    );
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[reminder-alerts] RESEND_API_KEY is not configured; cannot send digest email.",
      { ownerId: digest.ownerId, itemCount: digest.items.length },
    );
    return false;
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const rows = digest.items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(i.title)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(i.studentName)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(i.className)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${esc(i.dueDate ?? "")}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head><meta charset="utf-8" /><title>תזכורות שבאיחור</title></head>
  <body dir="rtl" style="margin:0;padding:24px;background:#f8fafc;font-family:Heebo,Arial,sans-serif;color:#0f172a;text-align:right;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 8px 0;font-size:20px;text-align:right;">תזכורות שבאיחור</h1>
      <p style="margin:0 0 16px 0;color:#475569;text-align:right;">
        יש לך ${digest.items.length} תזכורות שדורשות טיפול:
      </p>
      <table style="width:100%;border-collapse:collapse;direction:rtl;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:right;font-size:14px;">כותרת</th>
            <th style="padding:10px 12px;text-align:right;font-size:14px;">תלמיד</th>
            <th style="padding:10px 12px;text-align:right;font-size:14px;">כיתה</th>
            <th style="padding:10px 12px;text-align:right;font-size:14px;">תאריך יעד</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0 0;color:#64748b;font-size:12px;text-align:right;">
        הודעה אוטומטית מ"הכיתה שלי".
      </p>
    </div>
  </body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "הכיתה שלי <reminders@notifications.classalign.app>",
      to: digest.email,
      subject: `יש לך ${digest.items.length} תזכורות באיחור`,
      html,
    });
    if (error) {
      console.error("[reminder-alerts] Resend returned an error:", {
        ownerId: digest.ownerId,
        email: digest.email,
        error,
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[reminder-alerts] Unexpected error sending digest via Resend:", {
      ownerId: digest.ownerId,
      email: digest.email,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
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
    void logError("Failed to load overdue reminders", {
      source: LOG_SOURCE,
      context: { error: remindersError },
    });
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
    void logError(
      "Failed to load sent_reminder_alerts (continuing without dedup is unsafe, aborting run)",
      { source: LOG_SOURCE, context: { error: alertsError } },
    );
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
    void logError("Failed to load classes for pending reminders", {
      source: LOG_SOURCE,
      context: { error: classesRes.error, classIds },
    });
    return;
  }
  if (studentsRes.error) {
    void logError("Failed to load students for pending reminders", {
      source: LOG_SOURCE,
      context: { error: studentsRes.error, studentIds },
    });
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
      void logError(`Reminder references missing class; skipping.`, {
        source: LOG_SOURCE,
        context: { reminderId: r.id, classId: r.class_id },
      });
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
        void logError(`Failed to load auth user for digest`, {
          source: LOG_SOURCE,
          userId: digest.ownerId,
          context: { ownerId: digest.ownerId, error: userError },
        });
        continue;
      }
      digest.email = userRes?.user?.email ?? null;

      const delivered = await sendReminderDigestEmail(digest);
      if (!delivered) continue;

      const { error: insertError } = await supabaseAdmin.from("sent_reminder_alerts").insert(
        digest.items.map((i) => ({ reminder_id: i.reminderId })),
      );
      if (insertError) {
        void logError(
          `Digest was sent but recording sent_reminder_alerts failed (these reminders may be re-sent tomorrow).`,
          {
            source: LOG_SOURCE,
            userId: digest.ownerId,
            context: {
              ownerId: digest.ownerId,
              reminderIds: digest.items.map((i) => i.reminderId),
              error: insertError,
            },
          },
        );
      }
    } catch (err) {
      void logError(`Unexpected error processing teacher digest`, {
        source: LOG_SOURCE,
        userId: digest.ownerId,
        context: { ownerId: digest.ownerId, error: err instanceof Error ? err.message : String(err) },
      });
      // Continue with the remaining teachers — one teacher's failure must
      // not block the rest of the run.
    }
  }
}

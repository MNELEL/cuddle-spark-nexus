/**
 * Server-only notification fan-out. Uses the service-role client because a
 * notification is written for OTHER users (class owner, institution principals),
 * which RLS deliberately forbids from the acting user's session.
 */
export type NotifyClassArchivedInput = {
  classId: string;
  actorId: string;
};

export async function notifyClassArchived({ classId, actorId }: NotifyClassArchivedInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cls } = await supabaseAdmin
    .from("classes")
    .select("id, name, owner_id, institution_id, academic_year")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return;

  const recipients = new Set<string>();
  if (cls.owner_id) recipients.add(cls.owner_id);

  if (cls.institution_id) {
    const { data: staff } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("institution_id", cls.institution_id)
      .in("role", ["principal", "admin"]);
    for (const row of staff ?? []) recipients.add(row.user_id);
  }

  recipients.delete(actorId);
  if (recipients.size === 0) return;

  const yearSuffix = cls.academic_year ? ` (${cls.academic_year})` : "";
  const rows = [...recipients].map((recipient_id) => ({
    recipient_id,
    type: "class_archived",
    title: `הכיתה ״${cls.name}״ הועברה לארכיון`,
    body: `הכיתה${yearSuffix} נעולה לקריאה בלבד. אפשר לשחזר אותה ממסך הכיתות.`,
    class_id: cls.id,
    institution_id: cls.institution_id,
    actor_id: actorId,
  }));

  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) console.error("[Notify Error]", error);
}
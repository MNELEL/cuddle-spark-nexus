import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createClassFor,
  createInstitution,
  createTestUser,
  deleteInstitution,
  deleteTestUser,
  grantRole,
  hasTestEnv,
  type TestUser,
} from "./helpers";
import { SENSITIVE_FLAGS } from "@/lib/student-profiles.functions";

/**
 * `student_profiles` holds the most sensitive rows in the product (diagnoses,
 * family situation, incidents). The policy contract enforced here:
 *   - anon: no access whatsoever, read or write.
 *   - class owner: full CRUD.
 *   - unrelated teacher: nothing.
 *   - institution admin/principal: SELECT only — "מנהל צופה, לא כותב".
 */
describe.skipIf(!hasTestEnv)("RLS: student_profiles", () => {
  let owner: TestUser;
  let outsider: TestUser;
  let principal: TestUser;
  let institutionId: string;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    owner = await createTestUser("prof-owner");
    outsider = await createTestUser("prof-outsider");
    principal = await createTestUser("prof-principal");

    institutionId = (await createInstitution(`מוסד טסט ${crypto.randomUUID().slice(0, 8)}`)).id;
    await grantRole(principal, "principal", institutionId);

    classId = (await createClassFor(owner, "כיתה ב׳ — טסט")).id;
    // Link the class to the institution so the principal policy can match it.
    const link = await adminClient()
      .from("classes")
      .update({ institution_id: institutionId })
      .eq("id", classId);
    if (link.error) throw link.error;

    const student = await owner.client
      .from("students")
      .insert({ class_id: classId, name: "תלמיד טסט" })
      .select("id")
      .single();
    if (student.error) throw student.error;
    studentId = student.data.id;

    const seed = await owner.client.from("student_profiles").insert({
      student_id: studentId,
      class_id: classId,
      sensitive_flags: ["allergy"],
      sensitive_notes: "מידע רגיש לבדיקה",
      teaching_style_notes: "הנחיות הוראה",
      handoff_notes: "הדגשים למורה היורש",
    });
    if (seed.error) throw seed.error;
  });

  afterAll(async () => {
    await adminClient().from("student_profiles").delete().eq("student_id", studentId);
    await deleteTestUser(owner);
    await deleteTestUser(outsider);
    await deleteTestUser(principal);
    await deleteInstitution(institutionId);
  });

  /** Row as the service role sees it — the ground truth after a blocked write. */
  async function trueRow() {
    const { data } = await adminClient()
      .from("student_profiles")
      .select("sensitive_notes")
      .eq("student_id", studentId)
      .maybeSingle();
    return data;
  }

  it("only uses flags from the documented list", () => {
    expect(SENSITIVE_FLAGS).toContain("allergy");
    expect(SENSITIVE_FLAGS).not.toContain("health");
  });

  it("anon cannot read or write at all", async () => {
    const anon = anonClient();

    const read = await anon.from("student_profiles").select("student_id");
    expect(read.data ?? []).toHaveLength(0);

    const ins = await anon.from("student_profiles").insert({
      student_id: studentId,
      class_id: classId,
      sensitive_notes: "anon insert",
    });
    expect(ins.error).not.toBeNull();

    await anon.from("student_profiles").update({ sensitive_notes: "anon update" }).eq("student_id", studentId);
    await anon.from("student_profiles").delete().eq("student_id", studentId);
    expect((await trueRow())?.sensitive_notes).toBe("מידע רגיש לבדיקה");
  });

  it("the class owner has full read/write access", async () => {
    const read = await owner.client
      .from("student_profiles")
      .select("student_id, sensitive_notes, sensitive_flags")
      .eq("student_id", studentId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
    expect(read.data?.[0]?.sensitive_flags).toContain("allergy");

    const upd = await owner.client
      .from("student_profiles")
      .update({ sensitive_notes: "עודכן ע\"י הבעלים" })
      .eq("student_id", studentId)
      .select("sensitive_notes");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.sensitive_notes).toBe("עודכן ע\"י הבעלים");

    // restore the seed value for the later assertions
    await owner.client
      .from("student_profiles")
      .update({ sensitive_notes: "מידע רגיש לבדיקה" })
      .eq("student_id", studentId);
  });

  it("an unrelated teacher can neither read nor write", async () => {
    const read = await outsider.client.from("student_profiles").select("student_id").eq("student_id", studentId);
    expect(read.data ?? []).toHaveLength(0);

    const ins = await outsider.client
      .from("student_profiles")
      .insert({ student_id: studentId, class_id: classId, sensitive_notes: "outsider" });
    expect(ins.error).not.toBeNull();

    await outsider.client
      .from("student_profiles")
      .update({ sensitive_notes: "outsider update" })
      .eq("student_id", studentId);
    await outsider.client.from("student_profiles").delete().eq("student_id", studentId);
    expect((await trueRow())?.sensitive_notes).toBe("מידע רגיש לבדיקה");
  });

  it("an institution principal can read but never write", async () => {
    const read = await principal.client
      .from("student_profiles")
      .select("student_id, sensitive_notes")
      .eq("student_id", studentId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);

    const ins = await principal.client
      .from("student_profiles")
      .insert({ student_id: studentId, class_id: classId, sensitive_notes: "principal insert" });
    expect(ins.error).not.toBeNull();

    await principal.client
      .from("student_profiles")
      .update({ sensitive_notes: "principal update" })
      .eq("student_id", studentId);
    await principal.client.from("student_profiles").delete().eq("student_id", studentId);
    expect((await trueRow())?.sensitive_notes).toBe("מידע רגיש לבדיקה");
  });
});

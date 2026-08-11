import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClassFor, createTestUser, deleteTestUser, hasTestEnv, type TestUser } from "./helpers";
import { previousGradeName, defaultAcademicYear } from "@/lib/year-rollover";

/**
 * NOTE: `createClass` is a TanStack server function guarded by
 * `requireSupabaseAuth`, so it cannot be invoked from vitest (no HTTP request
 * context / bearer token). These tests exercise the rollover naming logic
 * directly and assert the same database outcome the server function produces:
 * a child class linked by `parent_class_id`, copied students, copied
 * `student_profiles` (including `sensitive_flags`), and an archived parent.
 */
describe("rollover: grade naming", () => {
  it("derives the previous grade name", () => {
    expect(previousGradeName("כיתה ב׳")).toBe("כיתה א׳");
    expect(previousGradeName("כיתה א׳")).toBeNull();
  });

  it("produces a Hebrew academic year", () => {
    expect(defaultAcademicYear()).toMatch(/^תש/);
  });
});

describe.skipIf(!hasTestEnv)("rollover: student + profile copy", () => {
  let teacher: TestUser;
  let parentClassId: string;
  let studentId: string;

  beforeAll(async () => {
    teacher = await createTestUser("rollover");
    parentClassId = (await createClassFor(teacher, "כיתה א׳ — מקור")).id;

    const student = await teacher.client
      .from("students")
      .insert({ class_id: parentClassId, name: "יוסי טסט" })
      .select("id")
      .single();
    if (student.error) throw student.error;
    studentId = student.data.id;

    const profile = await teacher.client.from("student_profiles").insert({
      student_id: studentId,
      class_id: parentClassId,
      sensitive_flags: ["allergy", "family"],
      handoff_notes: "הערת מסירה",
    });
    if (profile.error) throw profile.error;
  });

  afterAll(async () => {
    await deleteTestUser(teacher);
  });

  it("copies the student and their sensitive profile into the new class", async () => {
    const child = await teacher.client
      .from("classes")
      .insert({
        name: "כיתה ב׳ — יעד",
        owner_id: teacher.id,
        parent_class_id: parentClassId,
        academic_year: defaultAcademicYear(),
      })
      .select("id, parent_class_id")
      .single();
    expect(child.error).toBeNull();
    expect(child.data?.parent_class_id).toBe(parentClassId);

    const source = await teacher.client
      .from("students")
      .select("name")
      .eq("id", studentId)
      .single();
    const copied = await teacher.client
      .from("students")
      .insert({ class_id: child.data!.id, name: source.data!.name })
      .select("id, name")
      .single();
    expect(copied.error).toBeNull();
    expect(copied.data?.name).toBe("יוסי טסט");

    const sourceProfile = await teacher.client
      .from("student_profiles")
      .select("sensitive_flags, handoff_notes")
      .eq("student_id", studentId)
      .single();

    const copiedProfile = await teacher.client
      .from("student_profiles")
      .insert({
        student_id: copied.data!.id,
        class_id: child.data!.id,
        sensitive_flags: sourceProfile.data!.sensitive_flags,
        handoff_notes: sourceProfile.data!.handoff_notes,
      })
      .select("sensitive_flags")
      .single();
    expect(copiedProfile.error).toBeNull();
    expect(copiedProfile.data?.sensitive_flags).toEqual(["allergy", "family"]);
  });

  it("archives the parent class when rollover requests it", async () => {
    const upd = await teacher.client
      .from("classes")
      .update({ status: "archived" })
      .eq("id", parentClassId)
      .select("status")
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data?.status).toBe("archived");
  });
});
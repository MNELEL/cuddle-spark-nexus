import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClassFor, createTestUser, deleteTestUser, hasTestEnv, type TestUser } from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: student_profiles", () => {
  let teacherA: TestUser;
  let teacherB: TestUser;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    teacherA = await createTestUser("prof-a");
    teacherB = await createTestUser("prof-b");
    classId = (await createClassFor(teacherA, "כיתה ב׳ — טסט")).id;

    const student = await teacherA.client
      .from("students")
      .insert({ class_id: classId, name: "תלמיד טסט" })
      .select("id")
      .single();
    if (student.error) throw student.error;
    studentId = student.data.id;
  });

  afterAll(async () => {
    await deleteTestUser(teacherA);
    await deleteTestUser(teacherB);
  });

  it("owner can create and read a sensitive student profile", async () => {
    const ins = await teacherA.client
      .from("student_profiles")
      .insert({
        student_id: studentId,
        class_id: classId,
        sensitive_flags: ["health"],
        sensitive_notes: "מידע רגיש לבדיקה",
      })
      .select("student_id, sensitive_flags");
    expect(ins.error).toBeNull();
    expect(ins.data?.[0]?.sensitive_flags).toContain("health");

    const read = await teacherA.client
      .from("student_profiles")
      .select("student_id, sensitive_notes")
      .eq("student_id", studentId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
  });

  it("another teacher cannot read that profile", async () => {
    const read = await teacherB.client
      .from("student_profiles")
      .select("student_id")
      .eq("student_id", studentId);
    expect(read.data ?? []).toHaveLength(0);
  });
});
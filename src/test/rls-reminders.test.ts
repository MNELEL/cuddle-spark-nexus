import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createClassFor,
  createStudentFor,
  createTestUser,
  deleteTestUser,
  hasTestEnv,
  type TestUser,
} from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: reminders", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let studentId: string;
  let reminderId: string;

  beforeAll(async () => {
    owner = await createTestUser("rem-owner");
    other = await createTestUser("rem-other");
    classId = (await createClassFor(owner, "כיתה — תזכורות")).id;
    studentId = (await createStudentFor(owner, classId, "אברהם פרידמן")).id;
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("owner can create and read a reminder", async () => {
    const ins = await owner.client
      .from("reminders")
      .insert({ class_id: classId, student_id: studentId, title: "שיחה עם ההורים" })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    reminderId = ins.data!.id;

    const read = await owner.client.from("reminders").select("id, title").eq("id", reminderId);
    expect(read.data).toHaveLength(1);
  });

  it("another teacher cannot read, update or delete it", async () => {
    const read = await other.client.from("reminders").select("id").eq("id", reminderId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await other.client
      .from("reminders")
      .update({ title: "hijacked" })
      .eq("id", reminderId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const del = await other.client.from("reminders").delete().eq("id", reminderId).select("id");
    expect(del.data ?? []).toHaveLength(0);

    const check = await owner.client.from("reminders").select("title").eq("id", reminderId).single();
    expect(check.data?.title).toBe("שיחה עם ההורים");
  });

  it("anon cannot read or insert reminders", async () => {
    const anon = anonClient();
    const read = await anon.from("reminders").select("id").eq("id", reminderId);
    expect(read.data ?? []).toHaveLength(0);

    const ins = await anon
      .from("reminders")
      .insert({ class_id: classId, student_id: studentId, title: "anon" })
      .select("id");
    expect(ins.error).not.toBeNull();
  });

  it("owner can delete their reminder", async () => {
    const del = await owner.client.from("reminders").delete().eq("id", reminderId).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });
});

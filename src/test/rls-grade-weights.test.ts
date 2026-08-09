import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createClassFor,
  createTestUser,
  deleteTestUser,
  hasTestEnv,
  type TestUser,
} from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: grade_weights", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let weightId: string;

  beforeAll(async () => {
    owner = await createTestUser("gw-owner");
    other = await createTestUser("gw-other");
    classId = (await createClassFor(owner, "כיתה — משקלים")).id;
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("owner can create and update a subject weight", async () => {
    const ins = await owner.client
      .from("grade_weights")
      .insert({ class_id: classId, subject: "גמרא", weight: 3 })
      .select("id, weight")
      .single();
    expect(ins.error).toBeNull();
    weightId = ins.data!.id;

    const upd = await owner.client
      .from("grade_weights")
      .update({ weight: 2 })
      .eq("id", weightId)
      .select("weight")
      .single();
    expect(upd.data?.weight).toBe(2);
  });

  it("another teacher cannot read or update the weight", async () => {
    const read = await other.client.from("grade_weights").select("id").eq("id", weightId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await other.client
      .from("grade_weights")
      .update({ weight: 10 })
      .eq("id", weightId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const check = await owner.client
      .from("grade_weights")
      .select("weight")
      .eq("id", weightId)
      .single();
    expect(check.data?.weight).toBe(2);
  });

  it("anon cannot read or insert weights", async () => {
    const anon = anonClient();
    const read = await anon.from("grade_weights").select("id").eq("id", weightId);
    expect(read.data ?? []).toHaveLength(0);

    const ins = await anon
      .from("grade_weights")
      .insert({ class_id: classId, subject: "anon", weight: 1 })
      .select("id");
    expect(ins.error).not.toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createClassFor,
  createTestUser,
  deleteTestUser,
  hasTestEnv,
  type TestUser,
} from "./helpers";

/** Archive notifications — read by src/lib/notifications.functions.ts. */
describe.skipIf(!hasTestEnv)("RLS: class_notifications", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let notificationId: string;

  beforeAll(async () => {
    owner = await createTestUser("notif-owner");
    other = await createTestUser("notif-other");
    const cls = await createClassFor(owner, "כיתה — התראות");
    classId = cls.id;

    // Notifications are created server-side (service role), never by the client.
    const { data, error } = await adminClient()
      .from("class_notifications")
      .insert({
        class_id: classId,
        class_name: cls.name,
        recipient_id: owner.id,
        type: "archived_by_admin",
      })
      .select("id")
      .single();
    if (error) throw error;
    notificationId = data.id;
  });

  afterAll(async () => {
    await adminClient().from("class_notifications").delete().eq("id", notificationId);
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("recipient can read their notification", async () => {
    const read = await owner.client
      .from("class_notifications")
      .select("id, type, read_at")
      .eq("id", notificationId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
    expect(read.data?.[0]?.read_at).toBeNull();
  });

  it("recipient can mark it read", async () => {
    const upd = await owner.client
      .from("class_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .select("id, read_at")
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data?.read_at).not.toBeNull();
  });

  it("another user cannot read or mark it read", async () => {
    const read = await other.client.from("class_notifications").select("id").eq("id", notificationId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await other.client
      .from("class_notifications")
      .update({ read_at: null })
      .eq("id", notificationId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("clients cannot insert or delete notifications", async () => {
    const ins = await owner.client
      .from("class_notifications")
      .insert({
        class_id: classId,
        class_name: "spoof",
        recipient_id: owner.id,
        type: "archived_by_admin",
      })
      .select("id");
    expect(ins.error).not.toBeNull();

    const del = await owner.client
      .from("class_notifications")
      .delete()
      .eq("id", notificationId)
      .select("id");
    expect(del.data ?? []).toHaveLength(0);
  });

  it("anon sees nothing", async () => {
    const read = await anonClient()
      .from("class_notifications")
      .select("id")
      .eq("id", notificationId);
    expect(read.data ?? []).toHaveLength(0);
  });
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, "PIN חייב להיות 4 ספרות") });

function hashPin(pin: string, salt: string) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

export const getSecurity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("app_security")
      .select("pin_enabled, pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      pin_enabled: Boolean(data?.pin_enabled),
      has_pin: Boolean(data?.pin_hash),
    };
  });

export const setPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const salt = randomBytes(16).toString("hex");
    const hash = hashPin(data.pin, salt);
    const { error } = await supabase
      .from("app_security")
      .upsert({ user_id: userId, pin_enabled: true, pin_hash: hash, pin_salt: salt });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disablePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("app_security")
      .upsert({ user_id: userId, pin_enabled: false, pin_hash: null, pin_salt: null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("app_security")
      .select("pin_hash, pin_salt")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row?.pin_hash || !row?.pin_salt) return { ok: false };
    const expected = Buffer.from(row.pin_hash);
    const actual = Buffer.from(hashPin(data.pin, row.pin_salt));
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    return { ok };
  });
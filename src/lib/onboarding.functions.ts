import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ONBOARDING_STEPS = [
  "class", "students", "library", "tracking", "motivation", "reports",
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  /** Steps the הרב marked as done manually. */
  done: OnboardingStepId[];
  /** Steps detected as done from real data. */
  auto: OnboardingStepId[];
  dismissed: boolean;
  completedCount: number;
  total: number;
};

const stateSchema = z.object({
  done: z.array(z.enum(ONBOARDING_STEPS)).default([]),
  dismissed: z.boolean().default(false),
});

function build(raw: unknown, auto: OnboardingStepId[]): OnboardingState {
  const parsed = stateSchema.safeParse(raw ?? {});
  const done = parsed.success ? parsed.data.done : [];
  const dismissed = parsed.success ? parsed.data.dismissed : false;
  const merged = new Set<OnboardingStepId>([...done, ...auto]);
  return {
    done,
    auto,
    dismissed,
    completedCount: merged.size,
    total: ONBOARDING_STEPS.length,
  };
}

/** Reads the מדריך חכם progress, auto-detecting steps already achieved in real data. */
export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingState> => {
    const { supabase, userId } = context;

    const [profile, classes, resources] = await Promise.all([
      supabase.from("profiles").select("onboarding_state").eq("id", userId).maybeSingle(),
      supabase.from("classes").select("id").eq("owner_id", userId),
      supabase.from("teaching_resources").select("id").eq("owner_id", userId).limit(1),
    ]);

    const classIds = (classes.data ?? []).map((c) => c.id);
    const auto: OnboardingStepId[] = [];
    if (classIds.length > 0) auto.push("class");
    if ((resources.data ?? []).length > 0) auto.push("library");

    if (classIds.length > 0) {
      const [students, grades, rewards, bulletins] = await Promise.all([
        supabase.from("students").select("id").in("class_id", classIds).limit(1),
        supabase.from("grades").select("id").in("class_id", classIds).limit(1),
        supabase.from("rewards").select("id").in("class_id", classIds).limit(1),
        supabase.from("weekly_bulletins").select("id").in("class_id", classIds).limit(1),
      ]);
      if ((students.data ?? []).length > 0) auto.push("students");
      if ((grades.data ?? []).length > 0) auto.push("tracking");
      if ((rewards.data ?? []).length > 0) auto.push("motivation");
      if ((bulletins.data ?? []).length > 0) auto.push("reports");
    }

    return build(profile.data?.onboarding_state, auto);
  });

/** Marks a step as done / undone, or dismisses the wizard card. */
export const updateOnboardingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    step: z.enum(ONBOARDING_STEPS).optional(),
    done: z.boolean().optional(),
    dismissed: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const current = await supabase
      .from("profiles").select("onboarding_state").eq("id", userId).maybeSingle();

    const parsed = stateSchema.safeParse(current.data?.onboarding_state ?? {});
    const done = new Set<OnboardingStepId>(parsed.success ? parsed.data.done : []);
    let dismissed = parsed.success ? parsed.data.dismissed : false;

    if (data.step) {
      if (data.done === false) done.delete(data.step);
      else done.add(data.step);
    }
    if (typeof data.dismissed === "boolean") dismissed = data.dismissed;

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_state: { done: [...done], dismissed } })
      .eq("id", userId);
    if (error) throw new Error("שמירת התקדמות המדריך נכשלה");
    return { ok: true };
  });

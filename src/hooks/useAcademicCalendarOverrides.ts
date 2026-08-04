// src/hooks/useAcademicCalendarOverrides.ts
//
// CRUD for academic_calendar_overrides, plus an optional onMutated callback
// so the pacing screen can call refetch() from usePacingRecalculation right
// after a mutation. This client-side refetch is now the ONLY recalculation
// path — the old DB trigger (trg_recalc_pacing_on_override) was removed
// because it required a hardcoded service-role key to call the function.

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AcademicCalendarOverride {
  id: string;
  class_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  type: "institution_break" | "unexpected_closure" | "extra_session";
  label: string | null;
}

export function useAcademicCalendarOverrides(onMutated?: () => void) {
  const create = useCallback(
    async (override: Omit<AcademicCalendarOverride, "id">) => {
      const { data, error } = await supabase
        .from("academic_calendar_overrides")
        .insert(override)
        .select()
        .single();
      if (error) throw error;
      onMutated?.();
      return data as AcademicCalendarOverride;
    },
    [onMutated]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<AcademicCalendarOverride, "id" | "class_id">>) => {
      const { data, error } = await supabase
        .from("academic_calendar_overrides")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      onMutated?.();
      return data as AcademicCalendarOverride;
    },
    [onMutated]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("academic_calendar_overrides")
        .delete()
        .eq("id", id);
      if (error) throw error;
      onMutated?.();
    },
    [onMutated]
  );

  const list = useCallback(async (classId: string) => {
    const { data, error } = await supabase
      .from("academic_calendar_overrides")
      .select("*")
      .eq("class_id", classId)
      .order("start_date", { ascending: true });
    if (error) throw error;
    return data as AcademicCalendarOverride[];
  }, []);

  return { create, update, remove, list };
}

// src/hooks/usePacingRecalculation.ts
//
// Fires the recalculate-pacing edge function whenever the pacing page loads
// (or classId changes), and exposes the result + a manual refetch() so other
// actions (e.g. adding/editing a calendar override from the UI) can also
// trigger a recalculation on demand.
//
// Assumes a `supabase` client is already set up elsewhere in the project,
// e.g. src/integrations/supabase/client.ts — adjust the import path below
// to match where it actually lives in cuddle-spark-nexus.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PacingRecalcLogRow {
  id: string;
  class_id: string;
  computed_at: string;
  days_remaining: number | null;
  days_elapsed: number | null;
  units_behind_count: number | null;
  units_ahead_count: number | null;
  buffer_percent: number;
  ai_recommendation: string | null;
}

export interface PacingRecalcResult {
  result: PacingRecalcLogRow;
  yearStart: string;
  yearEnd: string;
  institutionBreaks: Array<{ start: string; end: string; label: string }>;
}

interface UsePacingRecalculationState {
  data: PacingRecalcResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePacingRecalculation(classId: string | undefined): UsePacingRecalculationState {
  const [data, setData] = useState<PacingRecalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "recalculate-pacing",
        { body: { classId } }
      );

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setData(fnData as PacingRecalcResult);
    } catch (err) {
      console.error("usePacingRecalculation error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  // recalculate on mount / whenever classId changes
  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

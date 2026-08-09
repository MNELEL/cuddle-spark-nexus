import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getToolAccess } from "@/lib/tool-access.functions";
import type { ToolAccess } from "@/lib/tool-registry";

/** Access flags for the signed-in user, cached for the session. */
export function useToolAccess(): { access: ToolAccess | undefined; isLoading: boolean } {
  const fetchAccess = useServerFn(getToolAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["tool-access"],
    queryFn: () => fetchAccess(),
    staleTime: 5 * 60 * 1000,
  });
  return { access: data, isLoading };
}

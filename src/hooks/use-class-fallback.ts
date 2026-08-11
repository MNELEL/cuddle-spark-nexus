import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { isAdmin } from "@/lib/user-roles.functions";

/**
 * When a class cannot be read (deleted, wrong id, or RLS denied) send the
 * viewer to a screen they can actually use: the institution dashboard for
 * admins, otherwise the classes list.
 */
export function useClassFallbackRedirect(missing: boolean) {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isAdmin);
  const { data: adminFlag } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!missing) return;
    const timer = setTimeout(() => {
      toast.error("הכיתה לא נמצאה או שאין לך הרשאה לצפות בה");
      navigate({ to: adminFlag ? "/institution" : "/classes", replace: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [missing, adminFlag, navigate]);
}
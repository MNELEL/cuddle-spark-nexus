import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, School, Building2, Map } from "lucide-react";
import { isAdmin } from "@/lib/user-roles.functions";

/**
 * Always-available escape hatch: back to the marketing home, to the teacher's
 * classes, or to the institution dashboard when the viewer is an admin.
 */
export function HomeQuickNav() {
  const checkAdmin = useServerFn(isAdmin);
  const { data: adminFlag } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60_000,
  });

  const item = "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <nav aria-label="ניווט חזרה" className="flex items-center gap-1">
      <Link to="/" className={item} data-quick-nav="home"><Home className="h-3.5 w-3.5" />בית</Link>
      <Link to="/classes" className={item} data-quick-nav="classes"><School className="h-3.5 w-3.5" />הכיתה שלי</Link>
      <Link to="/map" className={item} data-quick-nav="map"><Map className="h-3.5 w-3.5" />מפת המערכת</Link>
      {adminFlag && (
        <Link to="/institution" className={item} data-quick-nav="institution">
          <Building2 className="h-3.5 w-3.5" />דשבורד המוסד
        </Link>
      )}
    </nav>
  );
}

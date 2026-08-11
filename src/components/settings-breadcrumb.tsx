import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/**
 * Breadcrumb for the settings sub-routes that are NOT tabs of /settings
 * (brand, theme, unknown sub-paths). /settings itself is the "home" of the
 * area and its inner tabs are already marked by <SettingsTabs>, so no
 * breadcrumb is rendered there.
 */
export function SettingsBreadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="מסלול ניווט" className="mb-3 text-sm text-muted-foreground">
      <ol className="flex items-center gap-1">
        <li>
          <Link to="/settings" className="rounded hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            הגדרות
          </Link>
        </li>
        <li aria-hidden="true" className="flex items-center">
          <ChevronLeft className="h-3.5 w-3.5" />
        </li>
        <li aria-current="page" className="font-medium text-foreground">
          {current}
        </li>
      </ol>
    </nav>
  );
}
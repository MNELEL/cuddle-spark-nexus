import { Link, useRouterState } from "@tanstack/react-router";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { normalizePathname, sectionLabel, toolByPath } from "@/lib/tool-registry";

/**
 * Breadcrumbs for tool pages: ארגז כלים › <section> › <tool>.
 * Renders nothing on screens that aren't tools (classes, toolkit itself).
 */
export function ToolBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const entry = toolByPath(normalizePathname(pathname));
  if (!entry) return null;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild><Link to="/toolkit">ארגז כלים</Link></BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="rotate-180" />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/toolkit" search={{ section: entry.section }}>{sectionLabel(entry.section)}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="rotate-180" />
        <BreadcrumbItem>
          <BreadcrumbPage>{entry.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

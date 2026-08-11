import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route so the nested /checklist page can mount.
export const Route = createFileRoute("/blog/classroom-management-strategies")({
  component: () => <Outlet />,
});

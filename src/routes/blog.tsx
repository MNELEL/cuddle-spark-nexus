import { createFileRoute, Outlet } from "@tanstack/react-router";

// The blog is always-free content (see src/lib/free-access.ts) — no registration gate.
export const Route = createFileRoute("/blog")({
  component: () => <Outlet />,
});

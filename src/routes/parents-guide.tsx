import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/parents-guide")({
  component: () => <Outlet />,
});
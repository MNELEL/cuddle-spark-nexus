import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { RegistrationGate } from "@/components/registration-gate";
import { isAlwaysFree } from "@/lib/free-access";

function ToolsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Free tools stay open to everyone; every other tool needs a registered user
  // with an active trial.
  if (isAlwaysFree(pathname)) return <Outlet />;

  return (
    <RegistrationGate
      requireActiveTrial
      title="הכלי הזה פתוח לרשומים"
      description="הירשם במייל (בחינם, חודש ניסיון מלא) כדי להשתמש בכלי. הבלוג ומחולל הקבוצות פתוחים תמיד ללא רישום."
    >
      <Outlet />
    </RegistrationGate>
  );
}

export const Route = createFileRoute("/tools")({
  component: ToolsLayout,
});
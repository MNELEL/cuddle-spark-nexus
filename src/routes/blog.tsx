import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RegistrationGate } from "@/components/registration-gate";

export const Route = createFileRoute("/blog")({
  component: () => (
    <RegistrationGate
      title="הבלוג פתוח לרשומים בלבד"
      description="הירשם במייל (בחינם) כדי לקרוא את כל המדריכים, התבניות והצ׳קליסטים למלמדים ולרבנים."
    >
      <Outlet />
    </RegistrationGate>
  ),
});

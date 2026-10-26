import { createFileRoute, redirect } from "@tanstack/react-router";

// קישור ישיר /classes/<id>/day פותח את לשונית "מעקב יומי" בדף הכיתה.
export const Route = createFileRoute("/_authenticated/classes/$classId_/day")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/classes/$classId",
      params: { classId: params.classId },
      search: { tab: "day" },
      replace: true,
    });
  },
});

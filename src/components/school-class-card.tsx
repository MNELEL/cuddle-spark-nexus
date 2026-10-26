import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SchoolClass } from "@/lib/school.functions";

/** כרטיס כיתה במסך בית הספר: שם, שנה, מספר תלמידים וכניסה לכיתה. */
export function SchoolClassCard({ cls }: { cls: SchoolClass }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{cls.name}</span>
            {cls.academicYear && <Badge variant="secondary">{cls.academicYear}</Badge>}
            {cls.status === "archived" && <Badge variant="outline">בארכיון</Badge>}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {cls.students} תלמידים
          </p>
        </div>
        <Link to="/classes/$classId" params={{ classId: cls.id }}>
          <Button size="sm">כניסה לכיתה</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

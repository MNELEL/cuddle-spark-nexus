import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { listConfigs, saveConfig, loadConfig, deleteConfig } from "@/lib/seating-configs.functions";

export function SeatingSnapshots({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listConfigs);
  const saveFn = useServerFn(saveConfig);
  const loadFn = useServerFn(loadConfig);
  const delFn = useServerFn(deleteConfig);
  const [name, setName] = useState("");

  const { data: configs = [] } = useQuery({
    queryKey: ["seating-configs", classId],
    queryFn: () => listFn({ data: { classId } }),
  });

  const saveM = useMutation({
    mutationFn: (n: string) => saveFn({ data: { class_id: classId, name: n } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seating-configs", classId] });
      setName(""); toast.success("המבט נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const loadM = useMutation({
    mutationFn: (id: string) => loadFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      qc.invalidateQueries({ queryKey: ["class", classId] });
      toast.success("הסידור נטען");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seating-configs", classId] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost"><Camera className="ms-1 h-4 w-4" /> מבטים</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="text-xs font-semibold">שמירת מבט נוכחי</div>
        <div className="flex gap-2">
          <Input placeholder='שם (למשל: "תחילת שנה")' value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" disabled={!name.trim() || saveM.isPending} onClick={() => saveM.mutate(name.trim())}>שמור</Button>
        </div>
        <div className="border-t pt-2">
          <div className="mb-1 text-xs font-semibold">מבטים שמורים ({configs.length})</div>
          {configs.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">אין מבטים שמורים</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {configs.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded border bg-card px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono-tabular">
                      {new Date(c.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="טען" onClick={() => loadM.mutate(c.id)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="מחק" onClick={() => delM.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
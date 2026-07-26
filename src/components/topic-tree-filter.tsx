import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, Plus, Trash2, FolderTree, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { listTopics, upsertTopic, deleteTopic, buildTopicTree, type TopicRow } from "@/lib/topics.functions";

export function TopicTreeFilter({
  value, onChange,
}: { value: string | null; onChange: (id: string | null) => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listTopics);
  const upsert = useServerFn(upsertTopic);
  const del = useServerFn(deleteTopic);

  const { data: topics = [] } = useQuery({ queryKey: ["topics"], queryFn: () => list() });
  const tree = buildTopicTree(topics as TopicRow[]);
  const [manageOpen, setManageOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [parentId, setParentId] = useState<string | "root">("root");
  const [editing, setEditing] = useState<TopicRow | null>(null);

  const saveM = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id,
      name: name.trim(),
      parent_id: parentId === "root" ? null : parentId,
      color: color || "",
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setName(""); setColor(""); setParentId("root"); setEditing(null);
      toast.success("נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      toast.success("נמחק");
    },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const renderNode = (t: TopicRow, depth: number) => {
    const children = tree.get(t.id) ?? [];
    const isOpen = expanded.has(t.id);
    const isActive = value === t.id;
    return (
      <div key={t.id}>
        <div className="flex items-center gap-1" style={{ paddingInlineStart: depth * 12 }}>
          {children.length > 0 ? (
            <button className="p-0.5 text-muted-foreground" onClick={() => toggle(t.id)}>
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          ) : <span className="w-4" />}
          <button
            className={`flex-1 rounded px-2 py-1 text-right text-sm hover:bg-accent ${isActive ? "bg-accent font-medium" : ""}`}
            onClick={() => onChange(isActive ? null : t.id)}
            style={t.color ? { borderInlineStart: `3px solid ${t.color}` } : undefined}
          >
            {t.name}
          </button>
        </div>
        {isOpen && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = tree.get(null) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1"><FolderTree className="h-3 w-3" /> נושאים</Label>
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-1"><Pencil className="h-3 w-3" /></Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>ניהול נושאים</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-64 overflow-auto">
              {(topics as TopicRow[]).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">אין נושאים עדיין.</div>
              )}
              {(topics as TopicRow[]).map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded p-2">
                  <div className="text-sm">
                    <span style={t.color ? { color: t.color } : undefined}>{t.name}</span>
                    {t.parent_id && <span className="ms-2 text-xs text-muted-foreground">
                      · תת-נושא של {(topics as TopicRow[]).find((x) => x.id === t.parent_id)?.name}
                    </span>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setEditing(t); setName(t.name); setColor(t.color); setParentId(t.parent_id ?? "root"); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("למחוק נושא זה?")) delM.mutate(t.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-medium">{editing ? "עריכת נושא" : "נושא חדש"}</div>
              <Input placeholder="שם הנושא" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="צבע (למשל #f59e0b)" value={color} onChange={(e) => setColor(e.target.value)} />
                <Select value={parentId} onValueChange={(v) => setParentId(v)}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="נושא-אב" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">— (נושא ראשי)</SelectItem>
                    {(topics as TopicRow[]).filter((t) => t.id !== editing?.id).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              {editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(""); setColor(""); setParentId("root"); }}>ביטול</Button>}
              <Button onClick={() => saveM.mutate()} disabled={!name.trim() || saveM.isPending}>
                <Plus className="ms-1 h-4 w-4" /> {editing ? "עדכן" : "הוסף"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-0.5">
        <button
          className={`w-full rounded px-2 py-1 text-right text-sm hover:bg-accent ${value === null ? "bg-accent font-medium" : ""}`}
          onClick={() => onChange(null)}
        >
          כל הנושאים
        </button>
        {roots.map((t) => renderNode(t, 0))}
      </div>
    </div>
  );
}
import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Wrench, Music, Sparkles, BellRing, LineChart, Palette, BookOpen, GraduationCap,
  ScanText, TrendingUp, ClipboardList, Library, User, Users, Calendar,
  Award, FileText, Wand2, Trophy, Dices, Globe2, MessageSquare,
} from "lucide-react";
import { listClasses } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";

const OPEN_EVENT = "app:open-command-palette";

/** Open the global command palette from anywhere (e.g. a "more tools" button). */
export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }>; keywords?: string };

const GLOBAL_ITEMS: NavItem[] = [
  { label: "כיתות", to: "/classes", icon: GraduationCap, keywords: "class classes" },
  { label: "ארגז כלים", to: "/toolkit", icon: Wrench, keywords: "tools timer" },
  { label: "לוח צלילים", to: "/sound-board", icon: Music, keywords: "sound" },
  { label: "ספריית חומרים", to: "/resources", icon: Library, keywords: "resources library" },
  { label: "תובנות מורה", to: "/insights", icon: LineChart, keywords: "insights analytics" },
  { label: "בנק שאלות", to: "/questions", icon: ClipboardList, keywords: "questions" },
  { label: "העלאה חכמה", to: "/ingest", icon: Sparkles, keywords: "ingest ai" },
  { label: "לוח פעמונים", to: "/bell-schedule", icon: BellRing, keywords: "bell" },
  { label: "מיתוג מוסד", to: "/settings/brand", icon: Palette, keywords: "brand settings" },
  { label: "מדריכים", to: "/blog", icon: BookOpen, keywords: "blog guides" },
];

type ClassAction = {
  label: string;
  template: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "דוחות והפקות" | "AI ומבחנים" | "מעורבות והורים";
};

const CLASS_ACTIONS: ClassAction[] = [
  { label: "תעודות", template: "/certificates/", icon: Award, group: "דוחות והפקות" },
  { label: "דוח כיתה", template: "/reports/", icon: FileText, group: "דוחות והפקות" },
  { label: "אנליטיקה", template: "/analytics/", icon: TrendingUp, group: "דוחות והפקות" },
  { label: "יומן אירועים", template: "/calendar/", icon: Calendar, group: "דוחות והפקות" },
  { label: "עלון שבועי", template: "/bulletins/", icon: Sparkles, group: "AI ומבחנים" },
  { label: "סורק מבחנים", template: "/exam-scanner/", icon: ScanText, group: "AI ומבחנים" },
  { label: "מחולל מבחנים", template: "/exam-generator/", icon: Wand2, group: "AI ומבחנים" },
  { label: "ספריית עזרים", template: "/resources", icon: Library, group: "AI ומבחנים" },
  { label: "גיימיפיקציה", template: "/gamification/", icon: Trophy, group: "מעורבות והורים" },
  { label: "הגרלות", template: "/raffle/", icon: Dices, group: "מעורבות והורים" },
  { label: "פורטל הורים", template: "/parents/", icon: Users, group: "מעורבות והורים" },
  { label: "דף ציבורי", template: "/share/", icon: Globe2, group: "מעורבות והורים" },
  { label: "סקר כיתה חי", template: "/poll/", icon: MessageSquare, group: "מעורבות והורים" },
];

const CLASS_GROUPS = ["דוחות והפקות", "AI ומבחנים", "מעורבות והורים"] as const;

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const listCls = useServerFn(listClasses);
  const listSt = useServerFn(listStudents);

  const { data: classes = [] } = useQuery({
    queryKey: ["command:classes"],
    queryFn: () => listCls(),
    enabled: open,
  });

  // Load students for all classes (compact: only when palette open)
  const { data: allStudents = [] } = useQuery({
    queryKey: ["command:students", classes.map((c) => c.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        classes.map(async (c) => {
          const rows = await listSt({ data: { classId: c.id } });
          return (rows as Array<{ id: string; name: string }>).map((s) => ({ ...s, class_id: c.id, class_name: c.name }));
        }),
      );
      return results.flat();
    },
    enabled: open && classes.length > 0,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) triggerRef.current = document.activeElement as HTMLElement | null;
          return !v;
        });
      }
    };
    const onOpen = () => {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Return focus to whatever opened the palette once it closes.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      const el = triggerRef.current;
      triggerRef.current = null;
      if (el && typeof el.focus === "function" && document.contains(el)) {
        requestAnimationFrame(() => el.focus());
      }
    }
    setOpen(next);
  };

  const go = (to: string) => {
    triggerRef.current = null; // navigating away: don't steal focus back
    setOpen(false);
    // Use string navigation to avoid TS typed-route strictness for dynamic paths
    navigate({ to: to as never });
  };

  const students = useMemo(() => allStudents as Array<{ id: string; name: string; class_id: string; class_name: string }>, [allStudents]);

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput autoFocus placeholder="חפש עמוד, כיתה או תלמיד... (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>לא נמצאו תוצאות.</CommandEmpty>
        <CommandGroup heading="ניווט מהיר">
          {GLOBAL_ITEMS.map((i) => (
            <CommandItem key={i.to} value={`${i.label} ${i.keywords ?? ""}`} onSelect={() => go(i.to)}>
              <i.icon className="ms-2 h-4 w-4" />
              <span>{i.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {classes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="כיתות">
              {classes.map((c) => (
                <CommandItem key={c.id} value={`כיתה ${c.name}`} onSelect={() => go(`/classes/${c.id}`)}>
                  <Users className="ms-2 h-4 w-4" />
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {CLASS_GROUPS.map((g) => (
              <div key={g}>
                <CommandSeparator />
                <CommandGroup heading={g}>
                  {classes.flatMap((c) =>
                    CLASS_ACTIONS.filter((a) => a.group === g).map((a) => (
                      <CommandItem
                        key={`${c.id}-${a.template}`}
                        value={`${a.label} ${c.name}`}
                        onSelect={() => go(a.template.endsWith("/") ? `${a.template}${c.id}` : a.template)}
                      >
                        <a.icon className="ms-2 h-4 w-4" />
                        <span>{a.label} · {c.name}</span>
                      </CommandItem>
                    )),
                  )}
                </CommandGroup>
              </div>
            ))}
          </>
        )}
        {students.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="תלמידים">
              {students.map((s) => (
                <CommandItem key={s.id} value={`תלמיד ${s.name} ${s.class_name}`} onSelect={() => go(`/classes/${s.class_id}?student=${s.id}`)}>
                  <User className="ms-2 h-4 w-4" />
                  <span>{s.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{s.class_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
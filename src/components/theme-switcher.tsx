import { Palette, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useTheme, THEMES } from "@/hooks/use-theme";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="ערכת נושא" aria-label="ערכת נושא">
          <Palette className="h-4 w-4" />
          <span className="ms-1 hidden text-sm lg:inline">ערכת נושא</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>ערכת נושא</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => setTheme(t.id)} className="flex items-start gap-2 py-2">
            <div className="w-4 pt-0.5">{theme === t.id && <Check className="h-4 w-4 text-primary" />}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="flex items-center gap-2 py-2">
          <Link to="/theme-test" className="cursor-pointer">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">תצוגת בדיקה</div>
              <div className="text-xs text-muted-foreground">כל ערכות הנושא במבט אחד</div>
            </div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

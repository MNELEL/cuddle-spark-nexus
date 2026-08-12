import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Trash2, Upload, Loader2, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listCustomSoundsWithUrls, createCustomSound, deleteCustomSound, renameCustomSound,
  CUSTOM_SOUND_BUCKET,
} from "@/lib/custom-sounds.functions";
import { registerCustomSoundUrl, playSound } from "@/lib/sounds";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac"];

/** Upload, name, preview and delete the הרב's own sound files. */
export function CustomSoundsManager() {
  const qc = useQueryClient();
  const fetchSounds = useServerFn(listCustomSoundsWithUrls);
  const createSound = useServerFn(createCustomSound);
  const removeSound = useServerFn(deleteCustomSound);
  const rename = useServerFn(renameCustomSound);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const { data: sounds = [], isLoading } = useQuery({
    queryKey: ["custom-sounds-urls"],
    queryFn: () => fetchSounds(),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeSound({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-sounds-urls"] });
      toast.success("הצליל נמחק");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; name: string }) => rename({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-sounds-urls"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "עדכון השם נכשל"),
  });

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("יש לבחור קובץ שמע"); return; }
    const check = validateUploadFile(file, ACCEPT_AUDIO, MAX_BYTES / (1024 * 1024));
    if (!check.ok) { toast.error(check.message); return; }
    if (file.type && !ALLOWED.includes(file.type)) {
      toast.error(`סוג הקובץ "${file.name}" אינו נתמך. אפשר להעלות: MP3, WAV, OGG, M4A`);
      return;
    }
    setUploading(true);
    setStatus("מעלה את הצליל…");
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("נדרשת התחברות מחדש");
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase().slice(0, 5);
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(CUSTOM_SOUND_BUCKET)
        .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
      if (upErr) throw new Error("העלאת הקובץ נכשלה");
      await createSound({
        data: {
          name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
          storage_path: path,
          mime_type: file.type || "audio/mpeg",
          file_size: file.size,
        },
      });
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["custom-sounds-urls"] });
      setStatus("הצליל הועלה");
      toast.success("הצליל הועלה ומוכן לשימוש במיפוי האירועים");
    } catch (e) {
      setStatus("ההעלאה נכשלה");
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="sr-only" role="status" aria-live="polite">{status}</p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5" aria-hidden /> העלאת צליל משלי
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            אפשר להעלות ניגון, פעמון או הקלטה (MP3, WAV, OGG, M4A — עד 10MB), ואז לבחור אותו בכל אירוע במיפוי האירועים.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="custom-sound-file">קובץ שמע</Label>
              <Input id="custom-sound-file" ref={fileRef} type="file" accept={ACCEPT_AUDIO} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-sound-name">שם הצליל (לא חובה)</Label>
              <Input
                id="custom-sound-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="למשל: ניגון פתיחת יום"
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading} aria-busy={uploading}>
              {uploading ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="ms-1 h-4 w-4" aria-hidden />}
              העלאה
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">טוען צלילים…</p>
      ) : sounds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Music className="h-6 w-6" aria-hidden />
            עדיין לא הועלו צלילים אישיים.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sounds.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-2 py-4">
                <Input
                  defaultValue={s.name}
                  maxLength={80}
                  aria-label={`שם הצליל ${s.name}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.name) renameMut.mutate({ id: s.id, name: v });
                  }}
                />
                <Button
                  variant="outline" size="icon" className="min-h-11 min-w-11 shrink-0"
                  aria-label={`השמעת הצליל ${s.name}`}
                  onClick={() => {
                    if (!s.url) { toast.error("הקובץ אינו זמין"); return; }
                    registerCustomSoundUrl(`custom:${s.id}`, s.url);
                    playSound(`custom:${s.id}`);
                  }}
                >
                  <Play className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0 text-destructive"
                  aria-label={`מחיקת הצליל ${s.name}`}
                  onClick={() => del.mutate(s.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

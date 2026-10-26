import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateAppreciationLetter } from "@/lib/claude-tools.functions";
export function StudentAppreciationLetter({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const generate = useServerFn(generateAppreciationLetter);
  const mutation = useMutation({ mutationFn: () => generate({ data: { studentId } }), onSuccess: (r) => { setSubject(r.subject); setBody(r.body); } });
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Mail className="h-4 w-4" />מכתב הערכה אישי להורים</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>מכתב הערכה אישי להורים</DialogTitle><DialogDescription>טיוטה · תיעוד וציונים מהחודש האחרון</DialogDescription></DialogHeader>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{mutation.isPending ? "Claude מכין…" : "צור מכתב הערכה"}</Button>
      {mutation.error && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
      {body && <><Label htmlFor="letter-subject">נושא</Label><Input id="letter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /><Label htmlFor="letter-body">המכתב</Label><Textarea id="letter-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} /><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); toast.success("המכתב הועתק"); } catch { toast.error("ההעתקה נכשלה"); } }}><Copy className="h-4 w-4" />העתק מכתב</Button></>}
    </DialogContent></Dialog></>;
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { submitFeedback } from "@/lib/features/feedback.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "ส่งความคิดเห็น — WSC ProductionTrack" },
      { name: "description", content: "ส่งความคิดเห็น/แจ้งปัญหา/ข้อเสนอแนะให้แอดมิน" },
    ],
  }),
  component: FeedbackPage,
});

const CATEGORIES: Array<{ value: "bug" | "suggest" | "complain" | "praise" | "other"; label: string }> = [
  { value: "bug", label: "แจ้งบั๊ก/ข้อผิดพลาด" },
  { value: "suggest", label: "ข้อเสนอแนะ" },
  { value: "complain", label: "ร้องเรียน" },
  { value: "praise", label: "ชมเชย" },
  { value: "other", label: "อื่นๆ" },
];

function FeedbackPage() {
  const submit = useServerFn(submitFeedback);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    from_name: "",
    from_emp_code: "",
    from_phone: "",
    category: "suggest" as "bug" | "suggest" | "complain" | "praise" | "other",
    subject: "",
    message: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subject.trim().length < 2 || form.message.trim().length < 5) {
      toast.error("กรุณากรอกหัวข้อและรายละเอียดให้ครบ");
      return;
    }
    setLoading(true);
    try {
      await submit({ data: { ...form } });
      toast.success("ส่งเรียบร้อย ขอบคุณสำหรับความคิดเห็น");
      setForm({ from_name: "", from_emp_code: "", from_phone: "", category: "suggest", subject: "", message: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ส่งไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="กลับหน้าหลัก">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <MessageSquare className="h-5 w-5 text-primary" /> ส่งความคิดเห็น
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>มีอะไรอยากบอกแอดมิน?</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="name">ชื่อ (ไม่บังคับ)</Label>
                  <Input id="name" value={form.from_name} maxLength={120}
                    onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="code">รหัสพนักงาน</Label>
                  <Input id="code" value={form.from_emp_code} maxLength={40}
                    onChange={(e) => setForm({ ...form, from_emp_code: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="phone">โทรศัพท์ (ถ้าต้องการให้ติดต่อกลับ)</Label>
                  <Input id="phone" value={form.from_phone} maxLength={40}
                    onChange={(e) => setForm({ ...form, from_phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>หมวด</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="subject">หัวข้อ *</Label>
                <Input id="subject" value={form.subject} maxLength={200} required
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="msg">รายละเอียด *</Label>
                <Textarea id="msg" value={form.message} maxLength={5000} required rows={6}
                  onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                <Send className="mr-2 h-4 w-4" /> {loading ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

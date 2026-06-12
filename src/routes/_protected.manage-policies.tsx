// Admin editor for policy/terms documents.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, FileText, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { getPolicy, adminUpdatePolicy } from "@/lib/features/policies.functions";
import { PolicyView } from "@/components/PolicyView";
import { requireToken, showError } from "@/lib/utils/admin-helpers";

export const Route = createFileRoute("/_protected/manage-policies")({
  head: () => ({ meta: [{ title: "แก้ไขข้อกำหนด — WSC ProductionTrack" }] }),
  component: PoliciesEditor,
});

type Key = "terms" | "admin_policy";
const KEYS: { id: Key; label: string; icon: typeof FileText }[] = [
  { id: "terms", label: "ฝั่งสแกน (Terms)", icon: FileText },
  { id: "admin_policy", label: "ฝั่งแอดมิน (Admin Policy)", icon: ShieldCheck },
];

function PoliciesEditor() {
  const [active, setActive] = useState<Key>("terms");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">ข้อกำหนด & นโยบาย</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        แก้ไขเนื้อหาข้อกำหนดการใช้งานทั้งฝั่งสแกนและฝั่งหลังบ้าน (รองรับ Markdown)
      </p>
      <Tabs value={active} onValueChange={(v) => setActive(v as Key)}>
        <TabsList>
          {KEYS.map((k) => {
            const Icon = k.icon;
            return (
              <TabsTrigger key={k.id} value={k.id} className="gap-1">
                <Icon className="h-4 w-4" />
                {k.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {KEYS.map((k) => (
          <TabsContent key={k.id} value={k.id} className="mt-4">
            <PolicyEditor key={k.id} policyKey={k.id} />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

function PolicyEditor({ policyKey }: { policyKey: Key }) {
  const fetchPolicy = useServerFn(getPolicy);
  const updatePolicy = useServerFn(adminUpdatePolicy);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { policy } = await fetchPolicy({ data: { key: policyKey } });
      if (policy) {
        setTitle(policy.title);
        setContent(policy.content);
        setVersion(policy.version);
        setUpdatedAt(policy.updated_at);
      }
      setDirty(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyKey]);

  const save = async () => {
    if (!title.trim()) return toast.error("กรุณากรอกชื่อเรื่อง");
    setSaving(true);
    try {
      const { version: v } = await updatePolicy({
        data: { token: requireToken(), key: policyKey, title: title.trim(), content },
      });
      setVersion(v);
      setUpdatedAt(new Date().toISOString());
      setDirty(false);
      toast.success(`บันทึกแล้ว (เวอร์ชัน ${v})`);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            เวอร์ชัน {version}
            {updatedAt && (
              <>
                {" "}
                · ปรับปรุงล่าสุด{" "}
                {new Date(updatedAt).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </>
            )}
            {dirty && <span className="ml-2 text-amber-600">• ยังไม่บันทึก</span>}
          </div>
          <Button
            onClick={save}
            disabled={saving || !dirty}
            className="gap-1 bg-secondary hover:bg-secondary/90"
          >
            <Save className="h-4 w-4" /> {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>

        <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อเรื่อง</label>
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="mb-3"
        />

        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit" className="gap-1">
              <FileText className="h-4 w-4" /> เนื้อหา (Markdown)
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-4 w-4" /> Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-3">
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              rows={24}
              className="font-mono text-sm leading-relaxed"
              placeholder="# หัวข้อ&#10;&#10;เนื้อหา Markdown..."
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h2 className="mb-2 text-2xl font-bold">{title || "(ไม่มีชื่อเรื่อง)"}</h2>
              <PolicyView content={content} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { requireToken, showError } from "@/lib/utils/admin-helpers";
import { wiCategoriesList, wiCreate } from "@/lib/features/wi.functions";
import { WI_ACCENT_BTN, requireWiActor } from "@/lib/wi/wi-client";

export const Route = createFileRoute("/_protected/wi/new")({
  component: WiNewPage,
});

const NONE = "__none";

function WiNewPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(wiCreate);
  const catsFn = useServerFn(wiCategoriesList);
  const [cats, setCats] = useState<{ id: string; name: string }[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [owner, setOwner] = useState("");
  const [titleError, setTitleError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    catsFn({ data: { token: requireToken() } })
      .then((r) => setCats(r.rows.filter((c) => c.is_active)))
      .catch((err) => {
        showError(err);
        setCats([]);
      });
  }, [catsFn]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("กรอกชื่อ WI");
      return;
    }
    setSaving(true);
    try {
      const res = await createFn({
        data: {
          token: requireToken(),
          actor: requireWiActor(),
          doc: {
            title,
            description,
            category_id: categoryId === NONE ? null : categoryId,
            owner_name: owner,
            tags: [],
            est_minutes: null,
            equipment: "",
            safety_notes: "",
            related_docs: [],
            steps: [],
            translations: {},
          },
        },
      });
      toast.success(`สร้าง ${res.wi_code} แล้ว — เพิ่มขั้นตอนต่อได้เลย`);
      navigate({ to: "/wi/$wiId/edit", params: { wiId: res.id } });
    } catch (err) {
      showError(err, "สร้าง WI ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-12 pt-2">
      <Button asChild variant="ghost" size="sm" className="h-10 gap-1 px-2">
        <Link to="/wi/library">
          <ArrowLeft className="h-4 w-4" /> คลัง WI
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สร้าง Work Instruction</h1>
        <p className="text-sm text-muted-foreground">
          ระบบจะออกรหัส WI ให้อัตโนมัติ (แก้ไม่ได้) จากนั้นจะพาไปหน้าเพิ่มขั้นตอน
        </p>
      </div>
      <form onSubmit={create} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="new-title">
            ชื่อ WI <span className="text-destructive">*</span>
          </Label>
          <Input
            id="new-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleError("");
            }}
            placeholder="เช่น WI ประกอบม่านม้วน"
            maxLength={200}
            aria-invalid={!!titleError}
            className="h-11"
            autoFocus
          />
          {titleError && <p className="text-xs text-destructive">{titleError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-desc">คำอธิบายสั้น</Label>
          <Textarea
            id="new-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>หมวดหมู่</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!cats}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={cats ? "เลือกหมวด" : "กำลังโหลด…"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
                {(cats ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-owner">ผู้รับผิดชอบ</Label>
            <Input
              id="new-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              maxLength={120}
              className="h-11"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" className="h-11">
            <Link to="/wi/library">ยกเลิก</Link>
          </Button>
          <Button type="submit" className={cn("h-11 gap-1", WI_ACCENT_BTN)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            สร้างและเพิ่มขั้นตอน
          </Button>
        </div>
      </form>
    </main>
  );
}

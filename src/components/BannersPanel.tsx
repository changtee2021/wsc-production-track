// Home banner manager — moved out of /manage into /control.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateUploadUrl,
  adminInsertBanner,
  adminUpdateBanner,
  adminDeleteBanner,
} from "@/lib/features/admin.functions";
import { adminUpload, requireToken, showError } from "@/lib/utils/admin-helpers";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface Banner {
  id: string;
  image_path: string;
  sort_order: number;
  active: boolean;
}

const MAX_BANNERS = 3;

export function BannersPanel() {
  const insertFn = useServerFn(adminInsertBanner);
  const updateFn = useServerFn(adminUpdateBanner);
  const deleteFn = useServerFn(adminDeleteBanner);
  const createUrl = useServerFn(adminCreateUploadUrl);
  const [items, setItems] = useState<Banner[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("home_banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as Banner[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const publicUrlOf = (path: string) =>
    supabase.storage.from("banners").getPublicUrl(path).data.publicUrl;

  const onPick = async (file: File) => {
    if (items.length >= MAX_BANNERS) {
      toast.error(`เพิ่มแบนเนอร์ได้สูงสุด ${MAX_BANNERS} รูป`);
      return;
    }
    setUploading(true);
    try {
      const { path } = await adminUpload("banners", file, createUrl);
      const nextOrder = items.length > 0 ? Math.max(...items.map((b) => b.sort_order)) + 1 : 0;
      await insertFn({ data: { token: requireToken(), image_path: path, sort_order: nextOrder } });
      toast.success("เพิ่มแบนเนอร์สำเร็จ");
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await updateFn({ data: { token: requireToken(), id: b.id, active: !b.active } });
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const move = async (b: Banner, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === b.id);
    const swap = items[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        updateFn({ data: { token: requireToken(), id: b.id, sort_order: swap.sort_order } }),
        updateFn({ data: { token: requireToken(), id: swap.id, sort_order: b.sort_order } }),
      ]);
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const remove = async (b: Banner) => {
    if (!confirm("ลบแบนเนอร์นี้?")) return;
    try {
      await deleteFn({ data: { token: requireToken(), id: b.id, image_path: b.image_path } });
      toast.success("ลบสำเร็จ");
      await load();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">แบนเนอร์หน้าแรก</h2>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
            }}
          />
          <Button
            size="sm"
            disabled={uploading || items.length >= MAX_BANNERS}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            เพิ่มแบนเนอร์ ({items.length}/{MAX_BANNERS})
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        แนะนำสัดส่วนแนวตั้ง 3:4 หรือ 9:16 เพื่อให้แสดงผลเต็มพื้นที่บนมือถือ
      </p>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          ยังไม่มีแบนเนอร์ — กดเพิ่มแบนเนอร์เพื่ออัปโหลดรูปแรก
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((b, i) => (
            <li key={b.id} className="overflow-hidden rounded-xl border bg-background">
              <div className="relative aspect-[3/4] w-full bg-muted">
                <img
                  src={publicUrlOf(b.image_path)}
                  alt="banner"
                  className={`h-full w-full object-cover ${b.active ? "" : "opacity-40 grayscale"}`}
                />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  #{i + 1}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-0.5 p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-full"
                  disabled={i === 0}
                  onClick={() => move(b, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-full"
                  disabled={i === items.length - 1}
                  onClick={() => move(b, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-full"
                  onClick={() => toggleActive(b)}
                  title={b.active ? "ซ่อน" : "แสดง"}
                >
                  {b.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-full text-destructive hover:text-destructive"
                  onClick={() => remove(b)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default BannersPanel;

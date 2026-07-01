import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Wrench, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  verifyMaintenancePassword,
  listTickets,
  createTicket,
  getTicket,
  updateTicketStatus,
  closeTicket,
  addPartsUsed,
  removePartsUsed,
  listAssets,
  listSpareParts,
  maintenanceUploadMedia,
  maintenanceCreateVideoUploadUrl,
  listMaintenanceEmployees,
} from "@/lib/features/maintenance.functions";
import {
  setMaintenanceToken,
  getMaintenanceToken,
  clearMaintenanceSession,
} from "@/lib/auth/maintenance-session";
import { compressMedia } from "@/lib/utils/media-compress";
import { uploadVideoViaSignedUrl } from "@/lib/utils/direct-video-upload";
import { normalizeVideoFile, MAX_VIDEO_BYTES, formatVideoMaxSizeError } from "@/lib/utils/media-limits";
import { warnIfMovFiles } from "@/components/MediaLightbox";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "เจ้าหนูแจ้งซ่อม — WSC ProductionTrack" },
      { name: "description", content: "ระบบแจ้งซ่อมเครื่องจักรและจัดการสต๊อกอะไหล่" },
    ],
  }),
  component: MaintenancePage,
});

type MediaItem = { url: string; type: "image" | "video" };

function MaintenancePage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(getMaintenanceToken());
  }, []);
  if (!token)
    return (
      <LoginGate
        onAuth={(t) => {
          setMaintenanceToken(t);
          setToken(t);
        }}
      />
    );
  return (
    <Workbench
      token={token}
      onLogout={() => {
        clearMaintenanceSession();
        setToken(null);
      }}
    />
  );
}

function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const verify = useServerFn(verifyMaintenancePassword);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" /> เจ้าหนูแจ้งซ่อม
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                const r = await verify({ data: { password: pw } });
                if (!r.ok || !("token" in r)) throw new Error("รหัสผ่านไม่ถูกต้อง");
                onAuth(r.token!);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "เข้าระบบไม่สำเร็จ");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-3"
          >
            <Label>รหัสผ่าน</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Link to="/" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  ย้อนกลับ
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "เข้าใช้งาน"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Workbench({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background px-3 py-2">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Wrench className="h-5 w-5 text-amber-600" />
          <h1 className="font-bold">เจ้าหนูแจ้งซ่อม</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          ออก
        </Button>
      </header>
      <main className="mx-auto max-w-3xl p-3">
        <TicketsPanel token={token} />
      </main>
    </div>
  );
}

// ============ TICKETS ============
type Ticket = {
  id: string;
  ticket_no: string;
  status: string;
  priority: string;
  reporter_name: string;
  problem_text: string;
  reported_at: string;
  asset_id: string | null;
  assignee_name: string | null;
  fix_method: string | null;
  assets?: { id: string; code: string | null; name: string; location: string | null } | null;
  problem_media: MediaItem[];
  fix_media: MediaItem[];
};

const statusBadge = (s: string) => {
  const m: Record<string, string> = {
    open: "bg-rose-100 text-rose-700",
    in_progress: "bg-amber-100 text-amber-700",
    done: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-gray-200 text-gray-600",
  };
  const lbl: Record<string, string> = {
    open: "รอซ่อม",
    in_progress: "กำลังซ่อม",
    done: "เสร็จ",
    cancelled: "ยกเลิก",
  };
  return <Badge className={m[s] ?? ""}>{lbl[s] ?? s}</Badge>;
};

function TicketsPanel({ token }: { token: string }) {
  const list = useServerFn(listTickets);
  const [status, setStatus] = useState<"open" | "in_progress" | "done" | "all">("open");
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { token, status, limit: 200 } });
      setRows(r.rows as unknown as Ticket[]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, [status]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">รอซ่อม</SelectItem>
            <SelectItem value="in_progress">กำลังซ่อม</SelectItem>
            <SelectItem value="done">เสร็จแล้ว</SelectItem>
            <SelectItem value="all">ทั้งหมด</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto" />
        <Button onClick={() => setNewOpen(true)} className="bg-amber-600 hover:bg-amber-700">
          <Plus className="mr-1 h-4 w-4" />
          แจ้งซ่อม
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">— ไม่มีรายการ —</p>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => setDetailId(t.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold">{t.ticket_no}</span>
                      {statusBadge(t.status)}
                      {t.priority === "high" && <Badge variant="destructive">ด่วน</Badge>}
                    </div>
                    <div className="mt-1 truncate font-medium">
                      {t.assets?.name ?? "(ไม่ระบุเครื่อง)"}
                    </div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                      {t.problem_text}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      โดย {t.reporter_name} · {new Date(t.reported_at).toLocaleString("th-TH")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {newOpen && (
        <NewTicketDialog
          token={token}
          onClose={() => {
            setNewOpen(false);
            refresh();
          }}
        />
      )}
      {detailId && (
        <TicketDetailDialog
          token={token}
          id={detailId}
          onClose={() => {
            setDetailId(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function NewTicketDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const create = useServerFn(createTicket);
  const listA = useServerFn(listAssets);
  const [assets, setAssets] = useState<Array<{ id: string; name: string; code: string | null }>>(
    [],
  );
  const [assetId, setAssetId] = useState<string>("");
  const [reporter, setReporter] = useState("");
  const [problem, setProblem] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    listA({ data: { token } }).then((r) => setAssets(r.rows.filter((a) => a.active)));
  }, [listA, token]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>แจ้งซ่อมใหม่</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>เครื่อง/อุปกรณ์</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกเครื่อง (ไม่บังคับ)" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code ? `[${a.code}] ` : ""}
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>ชื่อผู้แจ้ง</Label>
            <Input value={reporter} onChange={(e) => setReporter(e.target.value)} />
          </div>
          <div>
            <Label>อาการ/ปัญหา</Label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>ความสำคัญ</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">ต่ำ</SelectItem>
                <SelectItem value="normal">ปกติ</SelectItem>
                <SelectItem value="high">ด่วน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MediaUploader token={token} media={media} onChange={setMedia} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            disabled={saving || !reporter || !problem}
            onClick={async () => {
              setSaving(true);
              try {
                const r = await create({
                  data: {
                    token,
                    asset_id: assetId || null,
                    reporter_name: reporter,
                    problem_text: problem,
                    problem_media: media,
                    priority,
                  },
                });
                toast.success(`สร้างใบงาน ${r.ticket_no}`);
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
              } finally {
                setSaving(false);
              }
            }}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailDialog({
  token,
  id,
  onClose,
}: {
  token: string;
  id: string;
  onClose: () => void;
}) {
  const get = useServerFn(getTicket);
  const upd = useServerFn(updateTicketStatus);
  const close = useServerFn(closeTicket);
  const addP = useServerFn(addPartsUsed);
  const rmP = useServerFn(removePartsUsed);
  const listP = useServerFn(listSpareParts);
  const listEmp = useServerFn(listMaintenanceEmployees);
  const [data, setData] = useState<{
    ticket: Ticket;
    parts: Array<{
      id: string;
      qty: number;
      spare_parts: { id: string; name: string; unit: string; code: string | null } | null;
    }>;
  } | null>(null);
  const [parts, setParts] = useState<
    Array<{ id: string; name: string; code: string | null; unit: string; stock_qty: number }>
  >([]);
  const [employees, setEmployees] = useState<
    Array<{ id: string; name: string; emp_code: string | null }>
  >([]);
  const [assignee, setAssignee] = useState("");
  const [fixMethod, setFixMethod] = useState("");
  const [fixMedia, setFixMedia] = useState<MediaItem[]>([]);
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);

  const refresh = async () => {
    const r = await get({ data: { token, id } });
    setData(r as unknown as typeof data);
    setAssignee(r.ticket.assignee_name ?? "");
    setFixMethod(r.ticket.fix_method ?? "");
    setFixMedia((r.ticket.fix_media as MediaItem[]) ?? []);
  };
  useEffect(() => {
    refresh();
    listP({ data: { token } }).then((r) =>
      setParts(r.rows.filter((p) => p.active && p.stock_qty > 0)),
    );
    listEmp({ data: { token } })
      .then((r) =>
        setEmployees(r.rows.map((e) => ({ id: e.id, name: e.name, emp_code: e.emp_code }))),
      )
      .catch(() => {});
    // eslint-disable-next-line
  }, [id]);

  if (!data) return null;
  const t = data.ticket;
  const isDone = t.status === "done";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{t.ticket_no}</span> {statusBadge(t.status)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <b>เครื่อง:</b> {t.assets?.name ?? "(ไม่ระบุ)"}
            {t.assets?.location ? ` · ${t.assets.location}` : ""}
          </div>
          <div>
            <b>ผู้แจ้ง:</b> {t.reporter_name} · {new Date(t.reported_at).toLocaleString("th-TH")}
          </div>
          <div>
            <b>ปัญหา:</b> {t.problem_text}
          </div>
          <MediaGrid items={t.problem_media} />

          {!isDone && (
            <>
              <div>
                <Label>ผู้รับผิดชอบซ่อม</Label>
                {employees.length > 0 ? (
                  <Select
                    value={employees.some((e) => e.name === assignee) ? assignee : ""}
                    onValueChange={setAssignee}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกช่างซ่อม" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.name}>
                          {e.emp_code ? `[${e.emp_code}] ` : ""}
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  className="mt-1"
                  placeholder="หรือพิมพ์ชื่อเอง"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {t.status === "open" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await upd({
                        data: { token, id, status: "in_progress", assignee_name: assignee || null },
                      });
                      toast.success("เริ่มซ่อมแล้ว");
                      refresh();
                    }}
                  >
                    เริ่มซ่อม
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("ยกเลิกใบงานนี้?")) return;
                    await upd({ data: { token, id, status: "cancelled" } });
                    toast.success("ยกเลิกแล้ว");
                    onClose();
                  }}
                >
                  ยกเลิกใบงาน
                </Button>
              </div>

              <div className="rounded border p-2">
                <div className="mb-2 font-semibold">เบิกอะไหล่</div>
                <div className="flex gap-2">
                  <Select value={partId} onValueChange={setPartId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="เลือกอะไหล่" />
                    </SelectTrigger>
                    <SelectContent>
                      {parts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code ? `[${p.code}] ` : ""}
                          {p.name} (เหลือ {p.stock_qty} {p.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-20"
                  />
                  <Button
                    size="sm"
                    disabled={!partId || qty < 1}
                    onClick={async () => {
                      try {
                        await addP({ data: { token, ticket_id: id, spare_part_id: partId, qty } });
                        toast.success("เบิกแล้ว — ตัดสต๊อกอัตโนมัติ");
                        setPartId("");
                        setQty(1);
                        refresh();
                        listP({ data: { token } }).then((r) =>
                          setParts(r.rows.filter((p) => p.active && p.stock_qty > 0)),
                        );
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "ผิดพลาด");
                      }
                    }}
                  >
                    เบิก
                  </Button>
                </div>
                {data.parts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.parts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span>
                          • {p.spare_parts?.name} × {p.qty} {p.spare_parts?.unit}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await rmP({ data: { token, id: p.id } });
                            toast.success("คืนสต๊อกแล้ว");
                            refresh();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label>วิธีซ่อม / สิ่งที่ทำ</Label>
                <Textarea
                  value={fixMethod}
                  onChange={(e) => setFixMethod(e.target.value)}
                  rows={3}
                />
              </div>
              <MediaUploader
                token={token}
                media={fixMedia}
                onChange={setFixMedia}
                label="รูป/วิดีโองานซ่อมที่ทำเสร็จ"
              />
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!fixMethod}
                onClick={async () => {
                  await close({
                    data: { token, id, fix_method: fixMethod, fix_media: fixMedia, summary: null },
                  });
                  toast.success("ปิดงานแล้ว");
                  onClose();
                }}
              >
                ปิดงาน (เสร็จสิ้น)
              </Button>
            </>
          )}

          {isDone && (
            <div className="rounded border bg-emerald-50 p-2">
              <div>
                <b>วิธีซ่อม:</b> {t.fix_method}
              </div>
              <MediaGrid items={t.fix_media} />
              {data.parts.length > 0 && (
                <div className="mt-2">
                  <b>อะไหล่ที่ใช้:</b>
                  <ul>
                    {data.parts.map((p) => (
                      <li key={p.id}>
                        • {p.spare_parts?.name} × {p.qty} {p.spare_parts?.unit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Asset/Spare-parts management moved to admin route /maintenance-master.

// ============ MEDIA HELPERS ============
function MediaUploader({
  token,
  media,
  onChange,
  label,
}: {
  token: string;
  media: MediaItem[];
  onChange: (m: MediaItem[]) => void;
  label?: string;
}) {
  const upload = useServerFn(maintenanceUploadMedia);
  const prepareVideoUpload = useServerFn(maintenanceCreateVideoUploadUrl);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File, kind: "image" | "video") => {
    setBusy(true);
    try {
      const source = kind === "video" ? normalizeVideoFile(file) : file;
      if (kind === "video" && !source) {
        toast.error("รองรับเฉพาะ MP4, WEBM, MOV, M4V");
        return;
      }
      if (kind === "video" && (source ?? file).size > MAX_VIDEO_BYTES) {
        toast.error(formatVideoMaxSizeError());
        return;
      }
      const compressed = await compressMedia(source ?? file, kind);
      if (kind === "video") {
        const r = await uploadVideoViaSignedUrl({
          bucket: "maintenance-media",
          file: compressed,
          deptToken: token,
          prepareUpload: prepareVideoUpload,
        });
        onChange([...media, { url: r.path, type: kind }]);
        return;
      }
      const buf = await compressed.arrayBuffer();
      let s = "";
      const arr = new Uint8Array(buf);
      const CHUNK = 0x8000;
      for (let i = 0; i < arr.length; i += CHUNK) {
        s += String.fromCharCode.apply(null, Array.from(arr.subarray(i, i + CHUNK)));
      }
      const dataBase64 = btoa(s);
      const r = await upload({ data: { token, kind, dataBase64 } });
      onChange([...media, { url: r.path, type: kind }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Label>{label ?? "รูป/วิดีโอแนบ"}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {media.map((m, i) => (
          <div key={i} className="relative h-16 w-16 overflow-hidden rounded border">
            <div className="flex h-full items-center justify-center bg-muted text-xs">
              {m.type === "video" ? "🎥" : "🖼"}
            </div>
            <button
              onClick={() => onChange(media.filter((_, j) => j !== i))}
              className="absolute -right-1 -top-1 rounded-full bg-rose-600 p-0.5 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "image")}
          />
        </label>
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border border-dashed">
          🎥
          <input
            type="file"
            className="hidden"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                warnIfMovFiles([f]);
                handleFile(f, "video");
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function MediaGrid({ items }: { items: MediaItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
      {items.map((m, i) => (
        <span key={i} className="rounded bg-muted px-2 py-0.5">
          {m.type === "video" ? "🎥" : "🖼"} ไฟล์ {i + 1}
        </span>
      ))}
    </div>
  );
}

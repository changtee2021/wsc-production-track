import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Toaster } from "@/components/ui/sonner";
import { getAdminToken } from "@/lib/auth/admin-session";
import {
  adminWhGetSettings,
  adminWhUpdateSettings,
  adminWhResetSettings,
  adminWhListTemplates,
  adminWhUpsertTemplate,
  adminWhListDestinations,
  adminWhUpsertDestination,
  adminWhListZones,
  adminWhUpsertZone,
  adminWhListReasonCodes,
  adminWhUpsertReasonCode,
  adminWhListLabelTemplates,
  adminWhUpsertLabelTemplate,
  adminWhListSyncLogs,
  adminWhListEmployees,
  adminWhUpsertEmployee,
  adminWhListVisionItems,
  adminWhUpsertVisionItem,
} from "@/lib/features/warehouse-settings.functions";
import type { WhSettingsKey } from "@/lib/warehouse/types";

export const Route = createFileRoute("/_protected/warehouse/settings")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "ตั้งค่าคลังสินค้า" }] }),
  component: WarehouseSettingsPage,
});

const SECTIONS: { id: string; title: string; key?: WhSettingsKey }[] = [
  { id: "general", title: "ทั่วไป", key: "general" },
  { id: "employees", title: "พนักงานคลัง" },
  { id: "vision", title: "เช็ควิสรับของ" },
  { id: "receiving", title: "รับของ", key: "receiving" },
  { id: "pallet", title: "Pallet", key: "pallet" },
  { id: "templates", title: "Pallet Templates" },
  { id: "scan", title: "พฤติกรรมสแกน", key: "scan" },
  { id: "export", title: "ส่งออก", key: "export" },
  { id: "zones", title: "โซนคลัง" },
  { id: "reasons", title: "Reason codes" },
  { id: "labels", title: "ฉลาก & PDF" },
  { id: "integration", title: "เชื่อม Backoffice", key: "integration" },
  { id: "audit", title: "Audit", key: "audit" },
];

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-2xl border border-border bg-card shadow-sm"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-2xl px-5 py-3 text-left font-semibold hover:bg-muted/40">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border p-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function JsonSettingsForm({
  settingsKey,
  values,
  onSave,
  onReset,
  fields,
}: {
  settingsKey: WhSettingsKey;
  values: Record<string, unknown>;
  onSave: (v: Record<string, unknown>) => void;
  onReset: () => void;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    options?: string[];
  }>;
}) {
  const [local, setLocal] = useState(values);
  if (JSON.stringify(local) !== JSON.stringify(values) && Object.keys(local).length === 0) {
    setLocal(values);
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <Label>{f.label}</Label>
          {f.type === "boolean" ? (
            <Switch
              checked={!!local[f.key]}
              onCheckedChange={(v) => setLocal((p) => ({ ...p, [f.key]: v }))}
            />
          ) : f.type === "select" ? (
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={String(local[f.key] ?? "")}
              onChange={(e) => setLocal((p) => ({ ...p, [f.key]: e.target.value }))}
            >
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={f.type === "number" ? "number" : "text"}
              value={String(local[f.key] ?? "")}
              onChange={(e) =>
                setLocal((p) => ({
                  ...p,
                  [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                }))
              }
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button onClick={() => onSave(local)}>
          <Save className="mr-2 h-4 w-4" />
          บันทึก
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          คืนค่าเริ่มต้น
        </Button>
      </div>
    </div>
  );
}

function WarehouseSettingsPage() {
  const { tab } = Route.useSearch();
  const token = getAdminToken() ?? "";
  const qc = useQueryClient();
  const getSettings = useServerFn(adminWhGetSettings);
  const updateSettings = useServerFn(adminWhUpdateSettings);
  const resetSettings = useServerFn(adminWhResetSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["wh-settings"],
    queryFn: () => getSettings({ data: { token } }),
    enabled: !!token,
  });

  const save = async (key: WhSettingsKey, value: Record<string, unknown>) => {
    await updateSettings({ data: { token, key, value } });
    toast.success("บันทึกแล้ว");
    qc.invalidateQueries({ queryKey: ["wh-settings"] });
  };

  const reset = async (key: WhSettingsKey) => {
    await resetSettings({ data: { token, key } });
    toast.success("คืนค่าเริ่มต้นแล้ว");
    qc.invalidateQueries({ queryKey: ["wh-settings"] });
  };

  const openId = tab && SECTIONS.some((s) => s.id === tab) ? tab : "general";

  if (isLoading || !settings) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <Toaster richColors />
      <h1 className="text-2xl font-bold">ตั้งค่าคลังสินค้า</h1>
      <p className="text-sm text-muted-foreground">
        ปรับพฤติกรรมระบบได้ทั้งหมดที่นี่ — ไม่ต้องแก้โค้ด
      </p>

      <Section title="ทั่วไป" defaultOpen={openId === "general"}>
        <JsonSettingsForm
          settingsKey="general"
          values={settings.general}
          onSave={(v) => save("general", v)}
          onReset={() => reset("general")}
          fields={[
            { key: "passcode_enabled", label: "เปิดรหัสผ่านหน้า Floor", type: "boolean" },
            { key: "passcode", label: "รหัสผ่าน", type: "text" },
            { key: "session_ttl_hours", label: "Session (ชม.)", type: "number" },
            { key: "company_code", label: "รหัสบริษัท", type: "text" },
          ]}
        />
      </Section>

      <Section title="พนักงานคลัง" defaultOpen={openId === "employees"}>
        <MasterListCrud
          token={token}
          type="employees"
          emptyHint="เพิ่มพนักงานที่ใช้งานหน้า Floor คลัง (เลือกจาก dropdown เหมือน QC)"
        />
      </Section>

      <Section title="เช็ควิสรับของ" defaultOpen={openId === "vision"}>
        <JsonSettingsForm
          settingsKey="vision"
          values={settings.vision ?? { enabled: true, require_all_before_confirm: true }}
          onSave={(v) => save("vision", v)}
          onReset={() => reset("vision")}
          fields={[
            { key: "enabled", label: "เปิดใช้เช็ควิส", type: "boolean" },
            {
              key: "require_all_before_confirm",
              label: "บังคับครบก่อนยืนยันรับของ",
              type: "boolean",
            },
          ]}
        />
        <MasterListCrud
          token={token}
          type="vision"
          emptyHint="รายการตรวจสอบก่อนยืนยันรับของ (ผ่าน/ไม่ผ่าน)"
        />
      </Section>

      <Section title="รับของ" defaultOpen={openId === "receiving"}>
        <JsonSettingsForm
          settingsKey="receiving"
          values={settings.receiving}
          onSave={(v) => save("receiving", v)}
          onReset={() => reset("receiving")}
          fields={[
            { key: "po_required", label: "บังคับ PO", type: "boolean" },
            { key: "adhoc_receipt_allowed", label: "รับแบบไม่มี PO", type: "boolean" },
            { key: "lot_no_required", label: "บังคับ Lot", type: "boolean" },
            { key: "mfg_date_required", label: "บังคับ MFG", type: "boolean" },
            { key: "exp_date_required", label: "บังคับ EXP", type: "boolean" },
            {
              key: "default_barcode_mode",
              label: "โหมด Barcode เริ่มต้น",
              type: "select",
              options: ["system", "supplier", "ask_each_receipt"],
            },
            { key: "box_code_format", label: "รูปแบบรหัสกล่อง", type: "text" },
            { key: "auto_confirm_on_full_scan", label: "ยืนยันอัตโนมัติเมื่อครบ", type: "boolean" },
          ]}
        />
      </Section>

      <Section title="Pallet" defaultOpen={openId === "pallet"}>
        <JsonSettingsForm
          settingsKey="pallet"
          values={settings.pallet}
          onSave={(v) => save("pallet", v)}
          onReset={() => reset("pallet")}
          fields={[
            { key: "mixed_lot_allowed", label: "อนุญาตหลาย Lot", type: "boolean" },
            { key: "mixed_product_allowed", label: "อนุญาตหลายสินค้า", type: "boolean" },
            { key: "pallet_no_format", label: "รูปแบบเลข Pallet", type: "text" },
            { key: "default_boxes_per_layer", label: "กล่อง/ชั้น เริ่มต้น", type: "number" },
            { key: "default_layers", label: "ชั้นเริ่มต้น", type: "number" },
            { key: "allow_manual_close_incomplete", label: "ปิดก่อนครบได้", type: "boolean" },
            { key: "require_supervisor_pin", label: "ต้อง PIN หัวหน้า", type: "boolean" },
          ]}
        />
      </Section>

      <Section title="พฤติกรรมสแกน" defaultOpen={openId === "scan"}>
        <JsonSettingsForm
          settingsKey="scan"
          values={settings.scan}
          onSave={(v) => save("scan", v)}
          onReset={() => reset("scan")}
          fields={[
            {
              key: "duplicate_scan_action",
              label: "สแกนซ้ำ",
              type: "select",
              options: ["reject", "warn_only"],
            },
            {
              key: "over_capacity_action",
              label: "เกินจำนวน",
              type: "select",
              options: ["block", "warn_allow"],
            },
            {
              key: "wrong_lot_action",
              label: "Lot ผิด",
              type: "select",
              options: ["block", "warn_allow"],
            },
            { key: "sound_enabled", label: "เสียง", type: "boolean" },
            { key: "vibration_enabled", label: "สั่น", type: "boolean" },
            { key: "almost_full_threshold_pct", label: "แจ้งเตือนใกล้เต็ม (%)", type: "number" },
          ]}
        />
      </Section>

      <Section title="ส่งออก" defaultOpen={openId === "export"}>
        <JsonSettingsForm
          settingsKey="export"
          values={settings.export}
          onSave={(v) => save("export", v)}
          onReset={() => reset("export")}
          fields={[
            { key: "container_no_required", label: "บังคับ Container", type: "boolean" },
            { key: "seal_no_required", label: "บังคับ Seal", type: "boolean" },
            { key: "destination_required", label: "บังคับปลายทาง", type: "boolean" },
            { key: "only_complete_pallets", label: "เฉพาะ Pallet ครบ", type: "boolean" },
            {
              key: "allow_incomplete_with_approval",
              label: "อนุญาต incomplete",
              type: "boolean",
            },
          ]}
        />
        <TemplatesCrud token={token} type="destinations" />
      </Section>

      <Section title="Pallet Templates" defaultOpen={openId === "templates"}>
        <TemplatesCrud token={token} type="templates" />
      </Section>

      <Section title="โซนคลัง" defaultOpen={openId === "zones"}>
        <TemplatesCrud token={token} type="zones" />
      </Section>

      <Section title="Reason codes" defaultOpen={openId === "reasons"}>
        <TemplatesCrud token={token} type="reasons" />
      </Section>

      <Section title="ฉลาก & PDF" defaultOpen={openId === "labels"}>
        <JsonSettingsForm
          settingsKey="labels"
          values={settings.labels}
          onSave={(v) => save("labels", v)}
          onReset={() => reset("labels")}
          fields={[
            { key: "pdf_footer_text", label: "ข้อความท้าย PDF", type: "text" },
            { key: "show_lot_on_label", label: "แสดง Lot บนฉลาก", type: "boolean" },
            { key: "show_exp_on_label", label: "แสดง EXP บนฉลาก", type: "boolean" },
          ]}
        />
        <TemplatesCrud token={token} type="labels" />
      </Section>

      <Section title="เชื่อม Backoffice" defaultOpen={openId === "integration"}>
        <JsonSettingsForm
          settingsKey="integration"
          values={settings.integration}
          onSave={(v) => save("integration", v)}
          onReset={() => reset("integration")}
          fields={[
            { key: "backoffice_sync_enabled", label: "เปิด sync", type: "boolean" },
            {
              key: "stock_sync_trigger",
              label: "ตัดสต๊อกเมื่อ",
              type: "select",
              options: ["on_receipt"],
            },
            { key: "webhook_retry_count", label: "Retry", type: "number" },
          ]}
        />
        <SyncLogs token={token} />
      </Section>

      <Section title="Audit" defaultOpen={openId === "audit"}>
        <JsonSettingsForm
          settingsKey="audit"
          values={settings.audit}
          onSave={(v) => save("audit", v)}
          onReset={() => reset("audit")}
          fields={[{ key: "scan_log_retention_days", label: "เก็บ log (วัน)", type: "number" }]}
        />
      </Section>
    </main>
  );
}

function SyncLogs({ token }: { token: string }) {
  const listFn = useServerFn(adminWhListSyncLogs);
  const { data: logs = [] } = useQuery({
    queryKey: ["wh-sync-logs"],
    queryFn: () => listFn({ data: { token, limit: 20 } }),
    enabled: !!token,
  });
  return (
    <div className="mt-4 space-y-2">
      <Label>Sync log ล่าสุด</Label>
      {logs.map((l) => (
        <div key={l.id} className="rounded border p-2 text-xs">
          {l.event_type} · {l.ref_no} · {l.status} — {l.response?.slice(0, 80)}
        </div>
      ))}
    </div>
  );
}

function MasterListCrud({
  token,
  type,
  emptyHint,
}: {
  token: string;
  type: "employees" | "vision";
  emptyHint: string;
}) {
  const qc = useQueryClient();
  const listEmp = useServerFn(adminWhListEmployees);
  const upsertEmp = useServerFn(adminWhUpsertEmployee);
  const listVis = useServerFn(adminWhListVisionItems);
  const upsertVis = useServerFn(adminWhUpsertVisionItem);
  const qk = `wh-master-${type}`;
  const [draft, setDraft] = useState<Record<string, Record<string, unknown>>>({});

  const { data: rows = [] } = useQuery({
    queryKey: [qk],
    queryFn: () =>
      type === "employees" ? listEmp({ data: { token } }) : listVis({ data: { token } }),
    enabled: !!token,
  });

  const rowVal = (row: Record<string, unknown>, key: string) => {
    const id = String(row.id);
    if (draft[id] && key in draft[id]) return draft[id][key];
    return row[key];
  };

  const setRowVal = (id: string, key: string, value: unknown) => {
    setDraft((p) => ({ ...p, [id]: { ...p[id], [key]: value } }));
  };

  const add = async () => {
    try {
      if (type === "employees") {
        await upsertEmp({ data: { token, name: "พนักงานใหม่", emp_code: "WH001" } });
      } else {
        await upsertVis({
          data: { token, label: "รายการตรวจใหม่", required: true, sort_order: rows.length + 1 },
        });
      }
      qc.invalidateQueries({ queryKey: [qk] });
      toast.success("เพิ่มแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  const saveRow = async (row: Record<string, unknown>) => {
    const id = String(row.id);
    const d = { ...row, ...(draft[id] ?? {}) };
    try {
      if (type === "employees") {
        await upsertEmp({
          data: {
            token,
            id: d.id as string,
            name: String(d.name ?? ""),
            emp_code: String(d.emp_code ?? ""),
            active: !!d.active,
            sort_order: Number(d.sort_order ?? 0),
          },
        });
      } else {
        await upsertVis({
          data: {
            token,
            id: d.id as string,
            label: String(d.label ?? ""),
            required: !!d.required,
            active: !!d.active,
            sort_order: Number(d.sort_order ?? 0),
          },
        });
      }
      setDraft((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
      qc.invalidateQueries({ queryKey: [qk] });
      toast.success("บันทึกแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{emptyHint}</p>
      <Button size="sm" variant="outline" onClick={add}>
        + เพิ่ม
      </Button>
      {rows.length === 0 && (
        <p className="text-sm text-amber-600">ยังไม่มีรายการ — พนักงาน Floor จะเข้าใช้งานไม่ได้</p>
      )}
      {rows.map((row: Record<string, unknown>) => (
        <div key={String(row.id)} className="space-y-2 rounded border p-3">
          {type === "employees" ? (
            <>
              <Input
                value={String(rowVal(row, "name") ?? "")}
                onChange={(e) => setRowVal(String(row.id), "name", e.target.value)}
                placeholder="ชื่อ"
              />
              <Input
                value={String(rowVal(row, "emp_code") ?? "")}
                onChange={(e) => setRowVal(String(row.id), "emp_code", e.target.value)}
                placeholder="รหัสพนักงาน"
              />
            </>
          ) : (
            <Textarea
              value={String(rowVal(row, "label") ?? "")}
              onChange={(e) => setRowVal(String(row.id), "label", e.target.value)}
              rows={2}
              placeholder="ข้อความเช็ควิส"
            />
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!rowVal(row, "active")}
                onCheckedChange={(v) => setRowVal(String(row.id), "active", v)}
              />
              ใช้งาน
            </label>
            {type === "vision" && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={!!rowVal(row, "required")}
                  onCheckedChange={(v) => setRowVal(String(row.id), "required", v)}
                />
                บังคับ
              </label>
            )}
          </div>
          <Button size="sm" onClick={() => saveRow(row)}>
            บันทึก
          </Button>
        </div>
      ))}
    </div>
  );
}

function TemplatesCrud({
  token,
  type,
}: {
  token: string;
  type: "templates" | "destinations" | "zones" | "reasons" | "labels";
}) {
  const qc = useQueryClient();
  const listTpl = useServerFn(adminWhListTemplates);
  const upsertTpl = useServerFn(adminWhUpsertTemplate);
  const listDest = useServerFn(adminWhListDestinations);
  const upsertDest = useServerFn(adminWhUpsertDestination);
  const listZones = useServerFn(adminWhListZones);
  const upsertZone = useServerFn(adminWhUpsertZone);
  const listReasons = useServerFn(adminWhListReasonCodes);
  const upsertReason = useServerFn(adminWhUpsertReasonCode);
  const listLabels = useServerFn(adminWhListLabelTemplates);
  const upsertLabel = useServerFn(adminWhUpsertLabelTemplate);

  const qk = `wh-crud-${type}`;
  const { data: rows = [] } = useQuery({
    queryKey: [qk],
    queryFn: async () => {
      if (type === "templates") return listTpl({ data: { token } });
      if (type === "destinations") return listDest({ data: { token } });
      if (type === "zones") return listZones({ data: { token } });
      if (type === "reasons") return listReasons({ data: { token } });
      return listLabels({ data: { token } });
    },
    enabled: !!token,
  });

  const add = async () => {
    try {
      if (type === "templates") {
        await upsertTpl({
          data: {
            token,
            item_code: "NEW",
            item_name: "สินค้าใหม่",
            boxes_per_layer: 12,
            layers: 8,
          },
        });
      } else if (type === "destinations") {
        await upsertDest({ data: { token, code: "DEST", name: "ปลายทางใหม่" } });
      } else if (type === "zones") {
        await upsertZone({ data: { token, code: "Z1", name: "โซนใหม่" } });
      } else if (type === "reasons") {
        await upsertReason({ data: { token, code: "R1", label: "เหตุผลใหม่" } });
      } else {
        await upsertLabel({ data: { token, code: "LBL", name: "ฉลากใหม่" } });
      }
      qc.invalidateQueries({ queryKey: [qk] });
      toast.success("เพิ่มแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={add}>
        + เพิ่ม
      </Button>
      {rows.map((r: Record<string, unknown>) => (
        <div key={String(r.id)} className="rounded border p-2 text-sm">
          {String(r.code ?? r.item_code ?? r.name ?? r.id)}
        </div>
      ))}
    </div>
  );
}

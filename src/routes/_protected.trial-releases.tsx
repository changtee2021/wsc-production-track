import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminToken } from "@/lib/auth/admin-session";
import {
  adminDeleteTrialRelease,
  adminListTrialReleases,
  adminUpdateTrialRelease,
} from "@/lib/scan-trial.functions";
import { TRIAL_FLOWS, trialProductLabel, type TrialFlowId } from "@/lib/scan-trial";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_protected/trial-releases")({
  head: () => ({ meta: [{ title: "ออเดอร์เข้าไลน์ — WSC ProductionTrack" }] }),
  component: TrialReleasesPage,
});

type ReleaseRow = {
  job_id: string;
  product: string;
  sent_by_name: string | null;
  created_at: string;
  updated_at: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrialReleasesPage() {
  const listReleases = useServerFn(adminListTrialReleases);
  const updateRelease = useServerFn(adminUpdateTrialRelease);
  const deleteRelease = useServerFn(adminDeleteTrialRelease);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await listReleases({ data: { token } });
      const next = (res.rows ?? []) as ReleaseRow[];
      setRows(next);
      setDrafts(Object.fromEntries(next.map((row) => [row.job_id, row.product])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "โหลดรายการไม่สำเร็จ");
    }
    setLoading(false);
  }, [listReleases]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(jobId: string) {
    const token = getAdminToken();
    const product = drafts[jobId];
    if (!token || !product) return;
    setBusyId(jobId);
    try {
      await updateRelease({
        data: { token, jobId, product: product as TrialFlowId },
      });
      toast.success("แก้สินค้าแล้ว");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "แก้สินค้าไม่สำเร็จ");
    }
    setBusyId(null);
  }

  async function remove(row: ReleaseRow) {
    const token = getAdminToken();
    if (!token) return;
    const ok = window.confirm(`ลบ ${row.job_id} ออกจากไลน์ผลิต?`);
    if (!ok) return;
    setBusyId(row.job_id);
    try {
      await deleteRelease({ data: { token, jobId: row.job_id } });
      toast.success("ลบแล้ว");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ");
    }
    setBusyId(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Toaster richColors position="top-center" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">ออเดอร์เข้าไลน์</h1>
        <p className="text-sm text-muted-foreground">
          ประวัติที่ออฟฟิศส่งเข้าไลน์ผลิต แก้สินค้าหรือลบได้จากหน้านี้
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">ยังไม่มีออเดอร์ที่ส่งเข้าไลน์</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3">เวลาที่ส่ง</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">คนคีย์</th>
                <th className="px-4 py-3">สินค้า</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.job_id}>
                  <td className="px-4 py-3 text-muted-foreground">{formatWhen(row.created_at)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{row.job_id}</td>
                  <td className="px-4 py-3">{row.sent_by_name || "พนักงานออฟฟิศ"}</td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`product-${row.job_id}`}>
                      สินค้าของ {row.job_id}
                    </label>
                    <select
                      id={`product-${row.job_id}`}
                      value={drafts[row.job_id] ?? row.product}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [row.job_id]: event.target.value }))
                      }
                      className="h-11 rounded-lg border bg-background px-2"
                    >
                      {TRIAL_FLOWS.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.label}
                        </option>
                      ))}
                      {!TRIAL_FLOWS.some((flow) => flow.id === row.product) && (
                        <option value={row.product}>{trialProductLabel(row.product)}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="min-h-11"
                        disabled={busyId === row.job_id || drafts[row.job_id] === row.product}
                        onClick={() => void save(row.job_id)}
                      >
                        บันทึก
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 text-red-700"
                        disabled={busyId === row.job_id}
                        onClick={() => void remove(row)}
                      >
                        ลบ
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

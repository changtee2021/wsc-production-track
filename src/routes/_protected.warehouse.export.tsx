import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminWhListPallets } from "@/lib/features/warehouse-pallet.functions";
import {
  adminWhCreateShipment,
  adminWhListDestinationsForExport,
} from "@/lib/features/warehouse-export.functions";

export const Route = createFileRoute("/_protected/warehouse/export")({
  head: () => ({ meta: [{ title: "โหลดตู้ส่งออก — คลังสินค้า" }] }),
  component: ExportPage,
});

function ExportPage() {
  const token = getAdminToken() ?? "";
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [container, setContainer] = useState("");
  const [seal, setSeal] = useState("");
  const [destination, setDestination] = useState("");
  const [sealedBy, setSealedBy] = useState("");

  const listPallets = useServerFn(adminWhListPallets);
  const listDest = useServerFn(adminWhListDestinationsForExport);
  const createShipment = useServerFn(adminWhCreateShipment);

  const { data: pallets = [] } = useQuery({
    queryKey: ["admin-wh-pallets-export"],
    queryFn: () => listPallets({ data: { token, status: "all" } }),
    enabled: !!token,
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ["wh-destinations"],
    queryFn: () => listDest({ data: { token } }),
    enabled: !!token,
  });

  const ready = pallets.filter((p) => p.status === "complete" || p.status === "incomplete");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      toast.error("เลือก Pallet อย่างน้อย 1");
      return;
    }
    try {
      await createShipment({
        data: {
          token,
          container_no: container,
          seal_no: seal,
          destination_text: destination,
          pallet_ids: [...selected],
          sealed_by: sealedBy,
        },
      });
      toast.success("บันทึกการโหลดตู้แล้ว");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-wh-pallets-export"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผิดพลาด");
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">โหลดตู้ส่งออก</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลตู้</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Container No.</Label>
            <Input value={container} onChange={(e) => setContainer(e.target.value)} />
          </div>
          <div>
            <Label>Seal No.</Label>
            <Input value={seal} onChange={(e) => setSeal(e.target.value)} />
          </div>
          <div>
            <Label>ปลายทาง</Label>
            <Input
              list="dest-list"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <datalist id="dest-list">
              {destinations.map((d) => (
                <option key={d.id} value={`${d.name} (${d.country})`} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>ผู้ปิดตู้</Label>
            <Input value={sealedBy} onChange={(e) => setSealedBy(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">เลือก Pallet ({selected.size})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ready.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
            >
              <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
              <span className="font-mono text-sm">{p.pallet_no}</span>
              <span className="text-sm text-muted-foreground">
                {p.counted_boxes}/{p.target_boxes} · {p.status}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
      <Button onClick={submit}>บันทึก & ปิดตู้</Button>
    </main>
  );
}

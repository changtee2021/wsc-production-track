import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminWhListPallets } from "@/lib/features/warehouse-pallet.functions";

export const Route = createFileRoute("/_protected/warehouse/pallets")({
  head: () => ({ meta: [{ title: "Pallet — คลังสินค้า" }] }),
  component: PalletsAdmin,
});

function PalletsAdmin() {
  const token = getAdminToken() ?? "";
  const listFn = useServerFn(adminWhListPallets);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-wh-pallets"],
    queryFn: () => listFn({ data: { token, status: "all" } }),
    enabled: !!token,
  });

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-bold">สถานะ Pallet</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pallet No.</TableHead>
            <TableHead>สินค้า / Lot</TableHead>
            <TableHead>ความคืบหน้า</TableHead>
            <TableHead>สถานะ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const r = p.wh_receipts as { item_code: string; lot_no: string } | null;
            const pct = (p.counted_boxes / p.target_boxes) * 100;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.pallet_no}</TableCell>
                <TableCell>
                  {r?.item_code} · Lot {r?.lot_no}
                </TableCell>
                <TableCell className="min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs tabular-nums">
                      {p.counted_boxes}/{p.target_boxes}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.status}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}

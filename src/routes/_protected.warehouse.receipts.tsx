import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminWhListReceipts } from "@/lib/features/warehouse-receiving.functions";

export const Route = createFileRoute("/_protected/warehouse/receipts")({
  head: () => ({ meta: [{ title: "รายการรับของ — คลังสินค้า" }] }),
  component: ReceiptsAdmin,
});

function ReceiptsAdmin() {
  const token = getAdminToken() ?? "";
  const listFn = useServerFn(adminWhListReceipts);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-wh-receipts"],
    queryFn: () => listFn({ data: { token, status: "all" } }),
    enabled: !!token,
  });

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-2xl font-bold">รายการรับของ</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>เลขที่</TableHead>
            <TableHead>PO</TableHead>
            <TableHead>สินค้า</TableHead>
            <TableHead>Lot</TableHead>
            <TableHead>กล่อง</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.receipt_no}</TableCell>
              <TableCell>{r.po_number || "—"}</TableCell>
              <TableCell>{r.item_code}</TableCell>
              <TableCell>{r.lot_no}</TableCell>
              <TableCell>
                {r.received_boxes}/{r.expected_boxes}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{r.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.backoffice_synced_at ? "OK" : r.backoffice_sync_error || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}

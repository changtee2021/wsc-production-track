import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminToken } from "@/lib/auth/admin-session";
import { adminWhExportReportCsv } from "@/lib/features/warehouse-reports.functions";

export const Route = createFileRoute("/_protected/warehouse/reports")({
  head: () => ({ meta: [{ title: "รายงาน — คลังสินค้า" }] }),
  component: ReportsPage,
});

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const token = getAdminToken() ?? "";
  const exportCsv = useServerFn(adminWhExportReportCsv);

  const dl = async (type: "receipts" | "pallets" | "shipments") => {
    const csv = await exportCsv({ data: { token, type } });
    if (csv === "empty") return;
    downloadCsv(`warehouse-${type}.csv`, csv);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">รายงานคลังสินค้า</h1>
      {(["receipts", "pallets", "shipments"] as const).map((t) => (
        <Card key={t}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{t}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => dl(t)}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel (CSV)
            </Button>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}

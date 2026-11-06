import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ProductionScanPage } from "@/components/ProductionScanPage";
import { SEQUENTIAL_SCAN_ENABLED } from "@/lib/sequential-scan";

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/scan")({
  validateSearch: zodValidator(scanSearchSchema),
  beforeLoad: ({ search }) => {
    if (SEQUENTIAL_SCAN_ENABLED) {
      throw redirect({
        to: "/scan-trial",
        search: { job_id: search.job_id, desk: "floor" },
      });
    }
  },
  component: ClassicScanPage,
});

function ClassicScanPage() {
  const { job_id } = Route.useSearch();
  const navigate = useNavigate({ from: "/scan" });
  return (
    <ProductionScanPage
      jobId={job_id}
      onJobId={(jobId) => {
        void navigate({ to: "/scan", search: { job_id: jobId }, replace: true });
      }}
    />
  );
}

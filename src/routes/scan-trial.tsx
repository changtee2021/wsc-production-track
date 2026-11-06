import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ScanTrialApp } from "@/components/ScanTrialApp";
import { SEQUENTIAL_SCAN_ENABLED } from "@/lib/sequential-scan";

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
  desk: fallback(z.enum(["office", "floor"]), "floor").default("floor"),
});

export const Route = createFileRoute("/scan-trial")({
  validateSearch: zodValidator(scanSearchSchema),
  beforeLoad: ({ search }) => {
    if (!SEQUENTIAL_SCAN_ENABLED && search.desk !== "office") {
      throw redirect({
        to: "/scan",
        search: { job_id: search.job_id },
      });
    }
  },
  head: () => ({
    meta: [{ title: "สแกน — WSC ProductionTrack" }],
  }),
  component: ScanV2Page,
});

function ScanV2Page() {
  const { job_id, desk } = Route.useSearch();
  return <ScanTrialApp initialJobId={job_id} desk={desk} />;
}

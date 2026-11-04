import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ScanTrialApp } from "@/components/ScanTrialApp";

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/scan-trial")({
  validateSearch: zodValidator(scanSearchSchema),
  head: () => ({
    meta: [{ title: "สแกน — WSC ProductionTrack" }],
  }),
  component: ScanV2Page,
});

function ScanV2Page() {
  const { job_id } = Route.useSearch();
  return <ScanTrialApp initialJobId={job_id} />;
}

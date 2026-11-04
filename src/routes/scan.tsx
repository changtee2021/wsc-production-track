import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/scan")({
  validateSearch: zodValidator(scanSearchSchema),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/scan-trial",
      search: { job_id: search.job_id },
    });
  },
});

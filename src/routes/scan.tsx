import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

const scanSearchSchema = z.object({
  job_id: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/scan")({
  validateSearch: zodValidator(scanSearchSchema),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: { job_id: search.job_id ?? "" } });
  },
  component: () => null,
});

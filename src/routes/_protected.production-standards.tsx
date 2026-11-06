import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/production-standards")({
  beforeLoad: () => {
    throw redirect({ to: "/production-setup", search: { tab: "std" } });
  },
});

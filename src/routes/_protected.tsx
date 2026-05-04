import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { isAdminSession, clearAdminSession } from "@/lib/admin-session";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, LogOut, FileText } from "lucide-react";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined" && !isAdminSession()) {
      throw redirect({
        to: "/admin",
        search: { redirect: location.href },
      });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader>
        <Link to="/dashboard">
          <Button variant="secondary" size="sm" className="gap-1">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        </Link>
        <Link to="/logs">
          <Button variant="secondary" size="sm" className="gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </Button>
        </Link>
        <Link to="/manage">
          <Button variant="secondary" size="sm" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Manage</span>
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1"
          onClick={() => {
            clearAdminSession();
            navigate({ to: "/admin" });
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </AppHeader>
      <Outlet />
    </div>
  );
}

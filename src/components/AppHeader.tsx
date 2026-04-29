import { Link } from "@tanstack/react-router";
import { Factory } from "lucide-react";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Factory className="h-5 w-5" />
          <span>ProductionTrack</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">{children}</div>
      </div>
    </header>
  );
}
